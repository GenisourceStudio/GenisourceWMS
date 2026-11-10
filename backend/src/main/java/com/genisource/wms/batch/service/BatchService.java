package com.genisource.wms.batch.service;

import com.genisource.wms.batch.domain.InventoryBatch;
import com.genisource.wms.batch.domain.SkuBatch;
import com.genisource.wms.batch.repository.InventoryBatchRepository;
import com.genisource.wms.batch.repository.SkuBatchRepository;
import com.genisource.wms.common.web.WmsException;
import com.genisource.wms.masterdata.domain.StorageLocation;
import com.genisource.wms.masterdata.repository.LocationRepository;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Batch bookkeeping. The aggregated `inventory` table remains the source of
 * truth for total on-hand; `inventory_batch` records the same quantity split by
 * batch, updated in the very same transaction via
 * {@link com.genisource.wms.inventory.service.InventoryService}.
 */
@Service
public class BatchService {

    /** A FEFO pick suggestion: take {@code qty} of one batch from one location. */
    public record BatchPick(
            Long batchId, String batchNo, LocalDate expiryDate,
            Long locationId, String locationCode, int qty) {
    }

    private final SkuBatchRepository skuBatchRepository;
    private final InventoryBatchRepository inventoryBatchRepository;
    private final LocationRepository locationRepository;

    public BatchService(
            SkuBatchRepository skuBatchRepository,
            InventoryBatchRepository inventoryBatchRepository,
            LocationRepository locationRepository) {
        this.skuBatchRepository = skuBatchRepository;
        this.inventoryBatchRepository = inventoryBatchRepository;
        this.locationRepository = locationRepository;
    }

    /** Finds a batch by (sku, batchNo) or creates it. Called inside the caller's transaction. */
    public SkuBatch resolveOrCreate(Long skuId, String batchNo, LocalDate expiryDate) {
        String code = batchNo.trim();
        return skuBatchRepository.findBySkuIdAndBatchNo(skuId, code)
                .orElseGet(() -> skuBatchRepository.save(new SkuBatch(skuId, code, expiryDate)));
    }

    /** Syncs batch-level stock. A negative delta is guarded by a row lock. */
    public void applyDelta(Long skuId, Long locationId, Long batchId, int delta) {
        InventoryBatch row = (delta < 0
                ? inventoryBatchRepository.lockOne(skuId, locationId, batchId)
                : inventoryBatchRepository.findBySkuIdAndLocationIdAndBatchId(skuId, locationId, batchId))
                .orElseGet(() -> new InventoryBatch(skuId, locationId, batchId, 0));

        if (delta < 0 && row.getQty() < -delta) {
            throw WmsException.conflict("INSUFFICIENT_BATCH_STOCK", "该批次库存不足");
        }
        row.applyDelta(delta);
        inventoryBatchRepository.save(row);
    }

    /**
     * FEFO allocation: batches with the earliest expiry first (NULL expiry last),
     * then by location code. Returns an empty list when the SKU has no tracked
     * batches, letting callers fall back to aggregated inventory.
     */
    public List<BatchPick> pick(Long skuId, int required) {
        List<InventoryBatch> rows = inventoryBatchRepository.findBySkuId(skuId).stream()
                .filter(b -> b.getQty() > 0)
                .toList();
        if (rows.isEmpty()) {
            return List.of();
        }

        Map<Long, SkuBatch> batches = new HashMap<>();
        for (InventoryBatch row : rows) {
            batches.computeIfAbsent(row.getBatchId(),
                    id -> skuBatchRepository.findById(id).orElse(null));
        }
        Map<Long, String> locationCodes = new HashMap<>();
        for (InventoryBatch row : rows) {
            locationCodes.computeIfAbsent(row.getLocationId(),
                    id -> locationRepository.findById(id).map(StorageLocation::getCode).orElse("?"));
        }

        List<InventoryBatch> sorted = new ArrayList<>(rows);
        sorted.sort(Comparator
                .comparing((InventoryBatch b) -> {
                    SkuBatch sb = batches.get(b.getBatchId());
                    return sb == null ? null : sb.getExpiryDate();
                }, Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(b -> locationCodes.getOrDefault(b.getLocationId(), "?")));

        List<BatchPick> picks = new ArrayList<>();
        int remaining = required;
        for (InventoryBatch row : sorted) {
            if (remaining <= 0) break;
            SkuBatch sb = batches.get(row.getBatchId());
            int take = Math.min(row.getQty(), remaining);
            picks.add(new BatchPick(
                    row.getBatchId(),
                    sb == null ? "?" : sb.getBatchNo(),
                    sb == null ? null : sb.getExpiryDate(),
                    row.getLocationId(),
                    locationCodes.getOrDefault(row.getLocationId(), "?"),
                    take));
            remaining -= take;
        }
        return picks;
    }
}
