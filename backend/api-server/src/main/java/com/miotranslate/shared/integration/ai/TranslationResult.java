package com.miotranslate.shared.integration.ai;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TranslationResult {
    private String translatedText;
    private String backTranslation;
    private BigDecimal confidenceScore;
    private String variableIntegrityStatus;
}
