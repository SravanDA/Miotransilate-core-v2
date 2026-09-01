package com.miotranslate.config.database;

import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Aspect
@Component
@Order(0) // Ensure this runs before Spring's Transactional aspect
public class ReadOnlyRouteAspect {

    @Around("@annotation(transactional)")
    public Object route(ProceedingJoinPoint joinPoint, Transactional transactional) throws Throwable {
        if (transactional.readOnly()) {
            RoutingDataSourceContextHolder.setDataSourceType(RoutingDataSourceContextHolder.DataSourceType.REPLICA);
        } else {
            RoutingDataSourceContextHolder.setDataSourceType(RoutingDataSourceContextHolder.DataSourceType.PRIMARY);
        }

        try {
            return joinPoint.proceed();
        } finally {
            RoutingDataSourceContextHolder.clearDataSourceType();
        }
    }
}
