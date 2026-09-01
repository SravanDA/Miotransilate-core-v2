package com.miotranslate.modules.translation.engine;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.miotranslate.modules.admin.model.SystemConfiguration;
import com.miotranslate.modules.admin.repository.SystemConfigurationRepository;
import com.miotranslate.modules.content.model.EnglishCopy;
import com.miotranslate.modules.content.model.EnglishCopyVersion;
import com.miotranslate.modules.content.repository.EnglishCopyRepository;
import com.miotranslate.modules.content.repository.EnglishCopyVersionRepository;
import com.miotranslate.modules.registry.model.Page;
import com.miotranslate.modules.registry.model.Tag;
import com.miotranslate.modules.registry.repository.PageRepository;
import com.miotranslate.modules.registry.repository.TagRepository;
import com.miotranslate.modules.translation.engine.model.PageJob;
import com.miotranslate.modules.translation.model.Translation;
import com.miotranslate.modules.translation.repository.TranslationRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@DisplayName("ContextAssembler Robustness & Batch Assembly Tests")
class ContextAssemblerRobustnessTest {

    @Mock
    private PageRepository pageRepository;

    @Mock
    private TagRepository tagRepository;

    @Mock
    private EnglishCopyRepository englishCopyRepository;

    @Mock
    private EnglishCopyVersionRepository englishCopyVersionRepository;

    @Mock
    private TranslationRepository translationRepository;

    @Mock
    private SystemConfigurationRepository configRepository;

    private ContextAssembler contextAssembler;
    private ObjectMapper objectMapper;

    @BeforeEach
    void setUp() {
        objectMapper = new ObjectMapper();
        contextAssembler = new ContextAssembler(
                pageRepository, tagRepository, englishCopyRepository,
                englishCopyVersionRepository, translationRepository,
                configRepository, objectMapper
        );
    }

    @Test
    @DisplayName("Assembles screen context, extracts term locks, and populates real English text")
    void testAssemblesCompletePageJobWithRealEnglishText() {
        String pageId = "page_appointments";
        Page page = new Page();
        page.setPageId(pageId);
        page.setPageName("Appointment Calendar");
        page.setModule("APPOINTMENTS");
        when(pageRepository.findById(pageId)).thenReturn(Optional.of(page));

        Tag tag1 = new Tag();
        tag1.setTagId("appt.btn.book");
        tag1.setPageId(pageId);
        tag1.setStatus("ACTIVE");

        Tag tag2 = new Tag();
        tag2.setTagId("appt.lbl.service");
        tag2.setPageId(pageId);
        tag2.setStatus("ACTIVE");

        when(tagRepository.findByPageIdAndStatusNot(pageId, "DEPRECATED")).thenReturn(List.of(tag1, tag2));

        EnglishCopy ec1 = new EnglishCopy();
        ec1.setTagId("appt.btn.book");
        ec1.setStatus("APPROVED");
        ec1.setCurrentVersionNumber(1);

        EnglishCopy ec2 = new EnglishCopy();
        ec2.setTagId("appt.lbl.service");
        ec2.setStatus("APPROVED");
        ec2.setCurrentVersionNumber(2);

        when(englishCopyRepository.findAllById(List.of("appt.btn.book", "appt.lbl.service")))
                .thenReturn(List.of(ec1, ec2));

        when(translationRepository.findByTagIdInAndLanguageCode(any(), eq("ar")))
                .thenReturn(Collections.emptyList());

        EnglishCopyVersion ecv1 = new EnglishCopyVersion();
        ecv1.setTagId("appt.btn.book");
        ecv1.setVersionNumber(1);
        ecv1.setText("Book Now");

        EnglishCopyVersion ecv2 = new EnglishCopyVersion();
        ecv2.setTagId("appt.lbl.service");
        ecv2.setVersionNumber(2);
        ecv2.setText("Select Service");

        when(englishCopyVersionRepository.findByTagIdIn(any())).thenReturn(List.of(ecv1, ecv2));

        SystemConfiguration termLocksConfig = new SystemConfiguration();
        termLocksConfig.setConfigKey("engine.term_locks");
        termLocksConfig.setConfigValue("{\"ar\": {\"Appointment\": \"موعد\", \"MioSalon\": \"MioSalon\"}}");
        when(configRepository.findById("engine.term_locks")).thenReturn(Optional.of(termLocksConfig));

        PageJob job = contextAssembler.assemble(pageId, "ar", null);

        assertNotNull(job);
        assertEquals(pageId, job.getPageId());
        assertEquals("Appointment Calendar", job.getPageName());
        assertEquals("APPOINTMENTS", job.getDomain());
        assertEquals(2, job.getAllTagIds().size());
        assertEquals(1, job.getChunks().size());

        assertEquals("Book Now", job.getChunks().get(0).getTagsToTranslate().get(0).getEnglishText());
        assertEquals("Select Service", job.getChunks().get(0).getTagsToTranslate().get(1).getEnglishText());
        assertEquals("موعد", job.getChunks().get(0).getTermLocks().get("Appointment"));
    }

    @Test
    @DisplayName("P0-7 Invariant: Skips tags whose target translation is already APPROVED")
    void testSkipsAlreadyApprovedTargetTranslations() {
        String pageId = "page_clients";
        Page page = new Page();
        page.setPageId(pageId);
        page.setPageName("Client List");
        page.setModule("CRM");
        when(pageRepository.findById(pageId)).thenReturn(Optional.of(page));

        Tag tag1 = new Tag();
        tag1.setTagId("client.approved");
        Tag tag2 = new Tag();
        tag2.setTagId("client.draft");
        when(tagRepository.findByPageIdAndStatusNot(pageId, "DEPRECATED")).thenReturn(List.of(tag1, tag2));

        EnglishCopy ec1 = new EnglishCopy();
        ec1.setTagId("client.approved");
        ec1.setStatus("APPROVED");
        ec1.setCurrentVersionNumber(1);

        EnglishCopy ec2 = new EnglishCopy();
        ec2.setTagId("client.draft");
        ec2.setStatus("APPROVED");
        ec2.setCurrentVersionNumber(1);

        when(englishCopyRepository.findAllById(any())).thenReturn(List.of(ec1, ec2));

        // Translation 1 is already APPROVED and not stale!
        Translation t1 = new Translation();
        t1.setTagId("client.approved");
        t1.setLanguageCode("ar");
        t1.setStatus("APPROVED");
        t1.setStaleTriggeredAt(null);

        // Translation 2 is DRAFT
        Translation t2 = new Translation();
        t2.setTagId("client.draft");
        t2.setLanguageCode("ar");
        t2.setStatus("DRAFT");

        when(translationRepository.findByTagIdInAndLanguageCode(any(), eq("ar"))).thenReturn(List.of(t1, t2));

        EnglishCopyVersion ecv2 = new EnglishCopyVersion();
        ecv2.setTagId("client.draft");
        ecv2.setVersionNumber(1);
        ecv2.setText("Draft Client Tag");
        when(englishCopyVersionRepository.findByTagIdIn(any())).thenReturn(List.of(ecv2));

        PageJob job = contextAssembler.assemble(pageId, "ar", null);

        // Only client.draft should be assembled in the chunks to translate!
        assertEquals(1, job.getAllTagIds().size());
        assertTrue(job.getAllTagIds().contains("client.draft"));
        assertFalse(job.getAllTagIds().contains("client.approved"));
    }

    @Test
    @DisplayName("Handles empty page or missing tags gracefully without exceptions")
    void testEmptyPageReturnsCleanEmptyJob() {
        String pageId = "empty_page";
        Page page = new Page();
        page.setPageId(pageId);
        when(pageRepository.findById(pageId)).thenReturn(Optional.of(page));
        when(tagRepository.findByPageIdAndStatusNot(pageId, "DEPRECATED")).thenReturn(Collections.emptyList());

        PageJob job = contextAssembler.assemble(pageId, "ar", null);
        assertNotNull(job);
        assertTrue(job.getAllTagIds().isEmpty());
        assertTrue(job.getChunks().isEmpty());
    }
}
