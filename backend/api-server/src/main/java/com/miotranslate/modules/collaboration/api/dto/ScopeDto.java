package com.miotranslate.modules.collaboration.api.dto;

public class ScopeDto {
    private String type;
    private String languageCode;

    public ScopeDto() {}

    public ScopeDto(String type, String languageCode) {
        this.type = type;
        this.languageCode = languageCode;
    }

    public String getType() {
        return type;
    }

    public void setType(String type) {
        this.type = type;
    }

    public String getLanguageCode() {
        return languageCode;
    }

    public void setLanguageCode(String languageCode) {
        this.languageCode = languageCode;
    }
}
