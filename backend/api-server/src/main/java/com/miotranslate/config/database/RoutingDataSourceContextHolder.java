package com.miotranslate.config.database;

public class RoutingDataSourceContextHolder {
    private static final ThreadLocal<DataSourceType> CONTEXT_HOLDER = new ThreadLocal<>();

    public enum DataSourceType {
        PRIMARY, REPLICA
    }

    public static void setDataSourceType(DataSourceType dataSourceType) {
        CONTEXT_HOLDER.set(dataSourceType);
    }

    public static DataSourceType getDataSourceType() {
        return CONTEXT_HOLDER.get() != null ? CONTEXT_HOLDER.get() : DataSourceType.PRIMARY;
    }

    public static void clearDataSourceType() {
        CONTEXT_HOLDER.remove();
    }
}
