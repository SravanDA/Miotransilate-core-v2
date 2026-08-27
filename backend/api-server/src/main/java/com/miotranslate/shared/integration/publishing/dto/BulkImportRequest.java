package com.miotranslate.shared.integration.publishing.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BulkImportRequest {
    private String domain;
    private String pageId;
    private String pageName;
    private List<TagData> tags;
    private List<String> removeTags;
}
