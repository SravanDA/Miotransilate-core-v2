package com.miotranslate.modules.reporting.model;

import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.Setter;

import java.io.Serializable;

@Getter
@Setter
@EqualsAndHashCode
public class CoverageMetricId implements Serializable {
    private String pageId;
    private String languageCode;
}
