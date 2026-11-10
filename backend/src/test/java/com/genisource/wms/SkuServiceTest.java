package com.genisource.wms;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import com.genisource.wms.common.web.WmsException;
import com.genisource.wms.masterdata.domain.Sku;
import com.genisource.wms.masterdata.repository.SkuRepository;
import com.genisource.wms.masterdata.service.SkuService;
import com.genisource.wms.masterdata.web.CreateSkuRequest;
import com.genisource.wms.masterdata.web.SkuResponse;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;

/**
 * Service-layer unit test with a plain Mockito mock — no Spring context, no
 * HTTP, no database. Verifies the SKU business rules around the unique code.
 */
class SkuServiceTest {

    private final SkuRepository skuRepository = mock(SkuRepository.class);
    private final SkuService skuService = new SkuService(skuRepository);

    @Test
    void duplicateCodeThrowsConflictAndDoesNotSave() {
        when(skuRepository.existsByCode("DUP")).thenReturn(true);

        WmsException ex = assertThrows(WmsException.class,
                () -> skuService.create(new CreateSkuRequest("DUP", "Duplicate", null, "PCS")));

        assertThat(ex.getStatus()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(ex.getCode()).isEqualTo("DUPLICATE_SKU_CODE");
        verify(skuRepository, never()).save(any(Sku.class));
    }

    @Test
    void createTrimsCodeAndPersistsAnActiveSku() {
        when(skuRepository.existsByCode("NEW")).thenReturn(false);
        when(skuRepository.save(any(Sku.class))).thenAnswer(invocation -> invocation.getArgument(0));

        SkuResponse response = skuService.create(
                new CreateSkuRequest("  NEW  ", "  Test SKU  ", "spec", "PCS"));

        assertThat(response.code()).isEqualTo("NEW");
        assertThat(response.name()).isEqualTo("Test SKU");
        assertThat(response.isActive()).isTrue();

        ArgumentCaptor<Sku> captor = ArgumentCaptor.forClass(Sku.class);
        verify(skuRepository).save(captor.capture());
        assertThat(captor.getValue().getCode()).isEqualTo("NEW");
        assertThat(captor.getValue().getName()).isEqualTo("Test SKU");
        assertThat(captor.getValue().isActive()).isTrue();
    }
}
