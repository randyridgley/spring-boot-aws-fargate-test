package com.example.demo;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.cloud.openfeign.EnableFeignClients;
import org.springframework.context.annotation.EnableAspectJAutoProxy;

@SpringBootApplication
@EnableAspectJAutoProxy
@EnableFeignClients(basePackages = {"com.example.demo.service.clients"})
@MapperScan(basePackages = "com.example.demo.dao")
public class SpringBootXRayApplication {

	public static void main(String[] args) {
		
		SpringApplication.run(SpringBootXRayApplication.class, args);
		
	}

}
