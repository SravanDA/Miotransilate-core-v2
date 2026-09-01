package com.miotranslate.shared.integration.ai.model;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Layer-3 Audit verification result item for a single flagged tag.
 * 
 * Verdict values:
 * - "correct": The translation accurately expresses the declared sense in the screen context
 * - "wrong_sense": The translation mistranslates the intended sense (e.g. Female as scarcity vs gender)
 * - "wrong_register": The tone or formality level is inappropriate for business UI
 * - "awkward": The phrasing is unnatural or grammatically questionable
 * - "unsure": The model cannot confidently verify the translation
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AuditResultItem {
    private String tag;
    private String verdict;       // correct | wrong_sense | wrong_register | awkward | unsure
    private String reading;       // How a native speaker reads it, in English
    private String better;        // Suggested replacement string, or null if correct
}
