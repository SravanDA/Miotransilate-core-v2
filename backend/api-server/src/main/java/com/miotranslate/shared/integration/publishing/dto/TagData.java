package com.miotranslate.shared.integration.publishing.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class TagData {
    private String tagName;
    private Map<String, String> values;
}
