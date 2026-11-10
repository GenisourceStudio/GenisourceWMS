package com.genisource.wms;

import static org.assertj.core.api.Assertions.assertThat;

import com.genisource.wms.inbound.domain.InboundLine;
import com.genisource.wms.inbound.domain.InboundOrder;
import com.genisource.wms.masterdata.domain.Partner;
import com.genisource.wms.masterdata.domain.Sku;
import com.genisource.wms.masterdata.domain.StorageLocation;
import org.junit.jupiter.api.Test;

/**
 * Pure unit test of the order status state machine — no Spring context, no
 * HTTP, no database. Status is derived solely from line progress via
 * {@link InboundOrder#recomputeStatus()}.
 */
class InboundOrderStateMachineTest {

    private static InboundOrder draftWithTwoLines() {
        Partner supplier = new Partner("SUP-UNIT", "Supplier", Partner.Type.SUPPLIER, null);
        InboundOrder order = new InboundOrder("DRAFT-NO", supplier, "unit test", null);
        order.addLine(new InboundLine(new Sku("SKU-A", "A", null, "PCS"), 10));
        order.addLine(new InboundLine(new Sku("SKU-B", "B", null, "PCS"), 5));
        return order;
    }

    @Test
    void statusIsDraftWhenNoLinesConfirmed() {
        InboundOrder order = draftWithTwoLines();
        order.recomputeStatus();
        assertThat(order.getStatus()).isEqualTo(InboundOrder.Status.DRAFT);
        assertThat(order.getCompletedAt()).isNull();
    }

    @Test
    void statusIsPartialWhenSomeLinesDone() {
        InboundOrder order = draftWithTwoLines();
        StorageLocation location = new StorageLocation("A-01-02", "A", null);
        order.getLines().get(0).confirm(location, 10, "tok-1", 1L);
        order.recomputeStatus();
        assertThat(order.getStatus()).isEqualTo(InboundOrder.Status.PARTIAL);
        assertThat(order.getCompletedAt()).isNull();
    }

    @Test
    void statusIsCompletedWhenAllLinesDone() {
        InboundOrder order = draftWithTwoLines();
        StorageLocation location = new StorageLocation("A-01-02", "A", null);
        order.getLines().get(0).confirm(location, 10, "tok-1", 1L);
        order.getLines().get(1).confirm(location, 5, "tok-2", 1L);
        order.recomputeStatus();
        assertThat(order.getStatus()).isEqualTo(InboundOrder.Status.COMPLETED);
        assertThat(order.getCompletedAt()).isNotNull();
    }

    @Test
    void anOrderWithNoLinesRecomputesToDraft() {
        Partner supplier = new Partner("SUP-UNIT", "Supplier", Partner.Type.SUPPLIER, null);
        InboundOrder order = new InboundOrder("DRAFT-NO", supplier, null, null);
        order.recomputeStatus();
        assertThat(order.getStatus()).isEqualTo(InboundOrder.Status.DRAFT);
        assertThat(order.getCompletedAt()).isNull();
    }
}
