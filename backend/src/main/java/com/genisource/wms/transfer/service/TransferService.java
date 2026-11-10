package com.genisource.wms.transfer.service;

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
import com.genisource.wms.transfer.domain.TransferLine;
import com.genisource.wms.transfer.domain.TransferOrder;
import com.genisource.wms.transfer.repository.TransferOrderRepository;
import com.genisource.wms.transfer.web.ConfirmTransferResponse;
import com.genisource.wms.transfer.web.TransferResponse;
import com.genisource.wms.transfer.web.CreateTransferRequest;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * 库位间调拨后端。库存写入只经过 InventoryService.recordStockChange；
 * confirmLine 在单个 @Transactional 方法内完成「TRANSFER_OUT + TRANSFER_IN」
 * 两次记账，净库存不变但库位分布改变，任一步失败整体回滚。
 */
@Service
public class TransferService {

    private final TransferOrderRepository orderRepository;
    private final SkuRepository skuRepository;
    private final LocationRepository locationRepository;
    private final InventoryRepository inventoryRepository;
    private final InventoryService inventoryService;

    /**
     * 仅用于幂等重放时从追加式流水里取回首次结果的 qty_after。两条标量查询，
     * 不需要新建仓库或修改任何现有文件/表结构（qty_after 本就落在流水里）。
     */
    @PersistenceContext
    private EntityManager entityManager;

    public TransferService(
            TransferOrderRepository orderRepository,
            SkuRepository skuRepository,
            LocationRepository locationRepository,
            InventoryRepository inventoryRepository,
            InventoryService inventoryService) {
        this.orderRepository = orderRepository;
        this.skuRepository = skuRepository;
        this.locationRepository = locationRepository;
        this.inventoryRepository = inventoryRepository;
        this.inventoryService = inventoryService;
    }

    @Transactional(readOnly = true)
    public PageResponse<TransferResponse> list(String status, int page, int size) {
        PageRequest pageable = PageRequest.of(
                Math.max(page, 0), Math.min(Math.max(size, 1), 100),
                Sort.by("createdAt").descending());

        Page<TransferOrder> result;
        if (status == null || status.isBlank()) {
            result = orderRepository.findAllByOrderByCreatedAtDesc(pageable);
        } else {
            TransferOrder.Status parsed;
            try {
                parsed = TransferOrder.Status.valueOf(status.trim().toUpperCase());
            } catch (IllegalArgumentException e) {
                throw WmsException.conflict("INVALID_STATUS", "未知的单据状态：" + status);
            }
            result = orderRepository.findByStatus(parsed, pageable);
        }
        return PageResponse.of(result, TransferResponse::from);
    }

    @Transactional(readOnly = true)
    public TransferResponse get(Long id) {
        return orderRepository.findById(id)
                .map(TransferResponse::from)
                .orElseThrow(() -> WmsException.notFound("调拨单不存在：" + id));
    }

    @Transactional
    public TransferResponse create(CreateTransferRequest request, Long operatorId) {
        List<TransferLine> lines = buildLines(request.lines());

        // 占位单号只存在于本事务内；flush 拿到自增 id 后即为 #### 后缀（须能放进 VARCHAR(32)）。
        TransferOrder order = new TransferOrder(
                "D" + UUID.randomUUID().toString().replace("-", "").substring(0, 30),
                request.remark(), operatorId);
        lines.forEach(order::addLine);

        orderRepository.saveAndFlush(order);
        order.assignOrderNo("DB");
        return TransferResponse.from(order);
    }

    /**
     * 确认单行：幂等守卫 → 行状态 → TRANSFER_OUT → TRANSFER_IN → 派生单据状态，
     * 全部在【同一个 @Transactional 方法】里。负 delta 触发 PESSIMISTIC_WRITE 行锁
     * + 库存充足校验；两步都走 recordStockChange（两条流水 + 两条审计）。任何异常
     * 都会回滚本事务内的实体变更、库存与流水，保证账实一致。
     */
    @Transactional
    public ConfirmTransferResponse confirmLine(
            Long orderId, Long lineId, String clientToken,
            UserPrincipal principal, String ip) {

        TransferOrder order = orderRepository.findById(orderId)
                .orElseThrow(() -> WmsException.notFound("调拨单不存在：" + orderId));
        TransferLine line = order.getLines().stream()
                .filter(l -> l.getId().equals(lineId))
                .findFirst()
                .orElseThrow(() -> WmsException.notFound("单据行不存在：" + lineId));

        // --- 幂等重放：行已完成且 token 相同 → 返回首次结果，不重复记账。
        // 该分支必须放在 ORDER_COMPLETED 守卫之前（单行单据首次确认即 COMPLETED，
        // 同 token 重放仍应回放结果而不是被判为 ORDER_COMPLETED）。
        if (line.isDone()) {
            if (clientToken != null && clientToken.equals(line.getConfirmToken())) {
                int qtyAfterFrom = ledgerQtyAfter(lineId, "TRANSFER_OUT")
                        .orElseGet(() -> currentQty(line.getSku().getId(), line.getFromLocation().getId()));
                int qtyAfterTo = ledgerQtyAfter(lineId, "TRANSFER_IN")
                        .orElseGet(() -> currentQty(line.getSku().getId(), line.getToLocation().getId()));
                return new ConfirmTransferResponse(
                        lineId, "DONE", order.getStatus().name(), qtyAfterFrom, qtyAfterTo);
            }
            throw WmsException.conflict("DUPLICATE_SCAN", "该行已完成，请勿重复扫描");
        }

        if (order.getStatus() == TransferOrder.Status.COMPLETED) {
            throw WmsException.conflict("ORDER_COMPLETED", "调拨单已完成");
        }

        Long skuId = line.getSku().getId();
        Long fromId = line.getFromLocation().getId();
        Long toId = line.getToLocation().getId();
        int qty = line.getQty();
        Long operatorId = principal == null ? null : principal.id();
        String operatorName = principal == null ? "system" : principal.displayName();

        if (!line.confirm(clientToken)) {
            throw WmsException.conflict("LINE_ALREADY_CONFIRMED", "该行已被其他作业确认");
        }

        Map<String, Object> outDetail = Map.of(
                "lineId", lineId,
                "clientToken", String.valueOf(clientToken),
                "fromLocationId", fromId,
                "toLocationId", toId,
                "direction", "OUT");
        Map<String, Object> inDetail = Map.of(
                "lineId", lineId,
                "clientToken", String.valueOf(clientToken),
                "fromLocationId", fromId,
                "toLocationId", toId,
                "direction", "IN");

        // 1) 源库位扣减（负 delta → 行锁 + 库存充足校验）。
        int qtyAfterFrom = inventoryService.recordStockChange(
                "TRANSFER_OUT", skuId, fromId, -qty,
                "TRANSFER", order.getId(), order.getOrderNo(), lineId,
                operatorId, operatorName, ip, outDetail);

        // 2) 目标库位增加（同一事务；净库存不变，仅库位分布变化）。
        int qtyAfterTo = inventoryService.recordStockChange(
                "TRANSFER_IN", skuId, toId, qty,
                "TRANSFER", order.getId(), order.getOrderNo(), lineId,
                operatorId, operatorName, ip, inDetail);

        // 状态由行进度派生：全部行完成 → COMPLETED。
        order.recomputeStatus();

        return new ConfirmTransferResponse(
                lineId, line.getStatus().name(), order.getStatus().name(),
                qtyAfterFrom, qtyAfterTo);
    }

    /** 仅 DRAFT 可删；级联删除行。 */
    @Transactional
    public void delete(Long id) {
        TransferOrder order = orderRepository.findById(id)
                .orElseThrow(() -> WmsException.notFound("调拨单不存在：" + id));
        if (order.getStatus() != TransferOrder.Status.DRAFT) {
            throw WmsException.conflict("ORDER_NOT_DELETABLE", "只有草稿单据可删除");
        }
        orderRepository.delete(order);
    }

    /**
     * 校验并组装行。库存按 (skuId, fromLocationId) 累计扣减「可用余额」：
     * 单行时等价于「源库位该 SKU 库存 >= qty」，多行共用同一来源时也可防止
     * 超卖。真正的扣减在确认时由 recordStockChange 二次校验并加锁。
     */
    private List<TransferLine> buildLines(List<CreateTransferRequest.Line> requested) {
        Map<String, Integer> remainingBySource = new HashMap<>();
        List<TransferLine> lines = new ArrayList<>();

        for (CreateTransferRequest.Line line : requested) {
            Sku sku = skuRepository.findById(line.skuId())
                    .orElseThrow(() -> WmsException.notFound("SKU 不存在：" + line.skuId()));
            if (!sku.isActive()) {
                throw WmsException.conflict("MASTER_DATA_INACTIVE", "SKU 已停用：" + sku.getCode());
            }

            StorageLocation from = requireActiveLocation(line.fromLocationId(), "源库位");
            StorageLocation to = requireActiveLocation(line.toLocationId(), "目标库位");

            if (from.getId().equals(to.getId())) {
                throw WmsException.conflict("SAME_LOCATION", "源库位与目标库位不能相同");
            }

            int qty = line.qty() == null ? 0 : line.qty();
            if (qty <= 0) {
                throw WmsException.conflict("INVALID_QTY", "调拨数量必须大于 0");
            }

            String key = line.skuId() + ":" + from.getId();
            int remaining = remainingBySource.computeIfAbsent(key,
                    k -> inventoryRepository.findBySkuIdAndLocationId(line.skuId(), from.getId())
                            .map(Inventory::getQty).orElse(0));
            if (remaining < qty) {
                throw WmsException.conflict("INSUFFICIENT_STOCK",
                        "源库位该 SKU 库存不足：" + sku.getCode() + " @ " + from.getCode());
            }
            remainingBySource.put(key, remaining - qty);

            lines.add(new TransferLine(sku, from, to, qty));
        }
        return lines;
    }

    private StorageLocation requireActiveLocation(Long id, String label) {
        StorageLocation location = locationRepository.findById(id)
                .orElseThrow(() -> WmsException.notFound(label + "不存在：" + id));
        if (!location.isActive()) {
            throw WmsException.conflict("MASTER_DATA_INACTIVE", label + "已停用：" + location.getCode());
        }
        return location;
    }

    /** 从追加式流水里取回首次确认记录的 qty_after，用于幂等重放返回首次结果。 */
    private Optional<Integer> ledgerQtyAfter(Long lineId, String type) {
        return entityManager.createQuery(
                "select t.qtyAfter from InventoryTxn t where t.lineId = :lineId and t.type = :type",
                Integer.class)
                .setParameter("lineId", lineId)
                .setParameter("type", type)
                .getResultStream()
                .findFirst();
    }

    private int currentQty(Long skuId, Long locationId) {
        return inventoryRepository.findBySkuIdAndLocationId(skuId, locationId)
                .map(Inventory::getQty).orElse(0);
    }
}
