package com.miotranslate.modules.translation.engine.model;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;
import java.util.Map;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class PreValidationResult {
    private List<String> skipList;
    private Map<String, List<String>> expectedPlaceholders;
}
