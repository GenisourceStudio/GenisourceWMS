package com.genisource.wms.stocktake.service;

import com.genisource.wms.common.web.PageResponse;
import com.genisource.wms.common.web.WmsException;
import com.genisource.wms.identity.security.JwtAuthenticationConverter.UserPrincipal;
import com.genisource.wms.inventory.domain.Inventory;
import com.genisource.wms.inventory.repository.InventoryRepository;
import com.genisource.wms.inventory.service.InventoryService;
import com.genisource.wms.masterdata.domain.Sku;
import com.genisource.wms.masterdata.domain.StorageLocation;
import com.genisource.wms.masterdata.repository.LocationRepository;
import com.genisource.wms.masterdata.repository.SkuRepository;
import com.genisource.wms.stocktake.domain.StocktakeLine;
import com.genisource.wms.stocktake.domain.StocktakeOrder;
import com.genisource.wms.stocktake.repository.StocktakeOrderRepository;
import com.genisource.wms.stocktake.web.ConfirmStocktakeResponse;
import com.genisource.wms.stocktake.web.StocktakeResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Stocktake (盘点) module. The create step snapshots a location's live inventory
 * into expected quantities; each line confirmation reconciles the counted value
 * against that snapshot via a single {@code ADJUST} movement through
 * {@link InventoryService} — the only stock write entry point.
 */
@Service
public class StocktakeService {

    private final StocktakeOrderRepository orderRepository;
    private final LocationRepository locationRepository;
    private final SkuRepository skuRepository;
    private final InventoryRepository inventoryRepository;
    private final InventoryService inventoryService;

    public StocktakeService(
            StocktakeOrderRepository orderRepository,
            LocationRepository locationRepository,
            SkuRepository skuRepository,
            InventoryRepository inventoryRepository,
            InventoryService inventoryService) {
        this.orderRepository = orderRepository;
        this.locationRepository = locationRepository;
        this.skuRepository = skuRepository;
        this.inventoryRepository = inventoryRepository;
        this.inventoryService = inventoryService;
    }

    @Transactional(readOnly = true)
    public PageResponse<StocktakeResponse> list(String status, int page, int size) {
        PageRequest pageable = PageRequest.of(
                Math.max(page, 0), Math.min(Math.max(size, 1), 100), Sort.by("createdAt").descending());

        Page<StocktakeOrder> result;
        if (status == null || status.isBlank()) {
            result = orderRepository.findAllByOrderByCreatedAtDesc(pageable);
        } else {
            StocktakeOrder.Status parsed;
            try {
                parsed = StocktakeOrder.Status.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw WmsException.conflict("INVALID_STATUS", "未知的单据状态：" + status);
            }
            result = orderRepository.findByStatus(parsed, pageable);
        }
        return PageResponse.of(result, StocktakeResponse::from);
    }

    @Transactional(readOnly = true)
    public StocktakeResponse get(Long id) {
        return orderRepository
                .findById(id)
                .map(StocktakeResponse::from)
                .orElseThrow(() -> WmsException.notFound("盘点单不存在：" + id));
    }

    /**
     * Creates a stocktake by snapshotting every (sku, qty) with qty &gt; 0 at
     * the given location from the {@code inventory} aggregate table. No stock is
     * written here — the snapshot is read-only.
     */
    @Transactional
    public StocktakeResponse create(Long locationId, String remark, Long operatorId) {
        StorageLocation location = locationRepository
                .findById(locationId)
                .orElseThrow(() -> WmsException.notFound("库位不存在：" + locationId));

        List<Inventory> stock = inventoryRepository.findAll().stream()
                .filter(i -> i.getLocationId().equals(locationId) && i.getQty() > 0)
                .toList();
        if (stock.isEmpty()) {
            throw WmsException.conflict("NO_STOCK_AT_LOCATION", "该库位无库存，无法创建盘点单");
        }

        // The uk_inventory_sku_location constraint guarantees one row per
        // (sku, location); merge defensively so uk_stocktake_line can never be
        // violated even if that invariant is ever relaxed.
        Map<Long, Integer> qtyBySku = new LinkedHashMap<>();
        for (Inventory i : stock) {
            qtyBySku.merge(i.getSkuId(), i.getQty(), Integer::sum);
        }

        List<StocktakeLine> lines = new ArrayList<>();
        for (Map.Entry<Long, Integer> entry : qtyBySku.entrySet()) {
            Sku sku = skuRepository
                    .findById(entry.getKey())
                    .orElseThrow(() -> WmsException.notFound("SKU 不存在：" + entry.getKey()));
            lines.add(new StocktakeLine(sku, entry.getValue()));
        }

        // A draft number only lives inside this transaction; flush assigns the
        // id that becomes the sequence suffix (SDD §5.5). Must fit VARCHAR(32).
        StocktakeOrder order = new StocktakeOrder(
                "D" + UUID.randomUUID().toString().replace("-", "").substring(0, 30),
                location, remark, operatorId);
        lines.forEach(order::addLine);

        orderRepository.saveAndFlush(order);
        order.assignOrderNo("PD");
        return StocktakeResponse.from(order);
    }

    /**
     * Confirms one counted line. delta = actualQty - expectedQty; a non-zero
     * delta is applied as a single ADJUST stock change inside this transaction,
     * a zero delta only marks the line done (no ledger/txn write, respecting
     * the ck_inventory_txn_delta CHECK). Then the order status is recomputed.
     */
    @Transactional
    public ConfirmStocktakeResponse confirmLine(
            Long orderId, Long lineId, int actualQty, UserPrincipal principal, String ip) {

        StocktakeOrder order = orderRepository
                .findById(orderId)
                .orElseThrow(() -> WmsException.notFound("盘点单不存在：" + orderId));

        StocktakeLine line = order.getLines().stream()
                .filter(l -> l.getId().equals(lineId))
                .findFirst()
                .orElseThrow(() -> WmsException.notFound("单据行不存在：" + lineId));

        if (line.isDone()) {
            throw WmsException.conflict("LINE_ALREADY_CONFIRMED", "该行已完成，请勿重复确认");
        }
        if (order.getStatus() == StocktakeOrder.Status.COMPLETED) {
            throw WmsException.conflict("ORDER_COMPLETED", "盘点单已完成");
        }
        if (actualQty < 0) {
            throw WmsException.conflict("INVALID_QTY", "实盘数量不能为负数");
        }

        int delta = actualQty - line.getExpectedQty();
        Long operatorId = principal == null ? null : principal.id();
        String operatorName = principal == null ? "system" : principal.displayName();
        Long skuId = line.getSku().getId();
        Long locationId = order.getLocation().getId();

        int qtyAfter;
        if (delta != 0) {
            // The ONLY stock write. Same transaction as the line/order update.
            qtyAfter = inventoryService.recordStockChange(
                    "ADJUST",
                    skuId,
                    locationId,
                    delta,
                    "STOCKTAKE",
                    order.getId(),
                    order.getOrderNo(),
                    line.getId(),
                    operatorId,
                    operatorName,
                    ip,
                    Map.of(
                            "expectedQty", line.getExpectedQty(),
                            "actualQty", actualQty,
                            "delta", delta,
                            "lineId", lineId));
        } else {
            // No ledger write; report the live aggregate qty for this sku/location.
            qtyAfter = inventoryRepository
                    .findBySkuIdAndLocationId(skuId, locationId)
                    .map(Inventory::getQty)
                    .orElse(line.getExpectedQty());
        }

        line.confirm(actualQty);
        order.recomputeStatus();

        return new ConfirmStocktakeResponse(
                lineId, line.getStatus().name(), delta, qtyAfter, order.getStatus().name());
    }

    /** Deletes a DRAFT order only; cascade (and the DB FK) removes its lines. */
    @Transactional
    public void delete(Long id) {
        StocktakeOrder order = orderRepository
                .findById(id)
                .orElseThrow(() -> WmsException.notFound("盘点单不存在：" + id));

        if (order.getStatus() != StocktakeOrder.Status.DRAFT) {
            throw WmsException.conflict("ORDER_NOT_DELETABLE", "只有草稿单据可删除");
        }
        orderRepository.delete(order);
    }
}
