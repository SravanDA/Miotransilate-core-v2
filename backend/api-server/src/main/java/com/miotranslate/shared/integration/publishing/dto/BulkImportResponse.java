package com.miotranslate.shared.integration.publishing.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class BulkImportResponse {
    private String pageId;
    private int processed;
    private int failed;
    private List<LanguageDetail> details;
}
