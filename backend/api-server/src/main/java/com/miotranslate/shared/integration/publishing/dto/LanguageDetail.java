package com.miotranslate.shared.integration.publishing.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class LanguageDetail {
    private String language;
    private String status;
    private String reason;
}
