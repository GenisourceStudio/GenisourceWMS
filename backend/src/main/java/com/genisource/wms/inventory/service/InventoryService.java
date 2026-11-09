package com.genisource.wms.inventory.service;

import com.genisource.wms.common.audit.OperationLog;
import com.genisource.wms.common.audit.OperationLogRepository;
import com.genisource.wms.common.web.WmsException;
import com.genisource.wms.inventory.domain.Inventory;
import com.genisource.wms.inventory.domain.InventoryTxn;
import com.genisource.wms.inventory.repository.InventoryRepository;
import com.genisource.wms.inventory.repository.InventoryTxnRepository;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import org.springframework.stereotype.Service;

/**
 * The ONLY entry point for writing stock (ARCHITECTURE.md §硬约束 1).
 *
 * <p>Every call writes the current state, the append-only ledger row and the
 * audit log inside the caller's transaction. Nothing else in the codebase is
 * allowed to touch inventory.qty, which is what makes "账实一致" structural
 * rather than a convention.
 */
@Service
public class InventoryService {

    private final InventoryRepository inventoryRepository;
    private final InventoryTxnRepository txnRepository;
    private final OperationLogRepository logRepository;

    public InventoryService(
            InventoryRepository inventoryRepository,
            InventoryTxnRepository txnRepository,
            OperationLogRepository logRepository) {
        this.inventoryRepository = inventoryRepository;
        this.txnRepository = txnRepository;
        this.logRepository = logRepository;
    }

    /**
     * Applies a signed delta. The caller must hold the transaction (and, for
     * outbound, the row lock). Returns the resulting quantity for the ledger.
     */
    public int recordStockChange(
            String type,
            Long skuId,
            Long locationId,
            int delta,
            String orderType,
            Long orderId,
            String orderNo,
            Long lineId,
            Long operatorId,
            String operatorName,
            String ip,
            Map<String, Object> auditDetail) {

        Optional<Inventory> locked = delta < 0
                ? inventoryRepository.lockBySkuAndLocation(skuId, locationId)
                : inventoryRepository.findBySkuIdAndLocationId(skuId, locationId);

        Inventory inventory = locked.orElseGet(() -> new Inventory(skuId, locationId, 0));

        if (delta < 0 && inventory.getQty() < -delta) {
            throw WmsException.conflict("INSUFFICIENT_STOCK", "库存不足，无法出库");
        }

        inventory.applyDelta(delta);
        int qtyAfter = inventory.getQty();
        inventoryRepository.save(inventory);

        txnRepository.save(new InventoryTxn(
                type, skuId, locationId, delta, qtyAfter,
                orderType, orderId, orderNo, lineId, operatorId, null));

        Map<String, Object> detail = new LinkedHashMap<>();
        if (auditDetail != null) {
            detail.putAll(auditDetail);
        }
        detail.put("skuId", skuId);
        detail.put("locationId", locationId);
        detail.put("delta", delta);
        detail.put("qtyAfter", qtyAfter);
        detail.put("orderNo", orderNo);

        logRepository.save(new OperationLog(
                operatorId,
                operatorName == null ? "system" : operatorName,
                "STOCK_" + type,
                "INVENTORY",
                inventory.getId(),
                detail,
                ip));

        return qtyAfter;
    }
}
