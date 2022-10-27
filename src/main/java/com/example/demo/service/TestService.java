package com.example.demo.service;

import com.example.demo.dao.TestMapper;
import com.example.demo.service.clients.TestClient;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.amazonaws.xray.interceptors.TracingInterceptor;
import com.amazonaws.xray.spring.aop.XRayEnabled;

import lombok.extern.slf4j.Slf4j;
import software.amazon.awssdk.auth.credentials.ProfileCredentialsProvider;
import software.amazon.awssdk.core.client.config.ClientOverrideConfiguration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

@Slf4j
@Service
@Transactional
@XRayEnabled
public class TestService {

	@Autowired
	private TestClient testClient;
	
	@Autowired
	private TestMapper testMapper;
	
	public void test(String bucket) {
		S3Client s3Client = S3Client.builder()
									.credentialsProvider(ProfileCredentialsProvider.create("default"))
									.region(Region.US_EAST_1)
									.overrideConfiguration(ClientOverrideConfiguration.builder()
											.addExecutionInterceptor(new TracingInterceptor())
											.build())
								.build();		
		s3Client.listBuckets();		
		testClient.getNaver();		
		testMapper.count(1);
		log.debug("Serviced");
	}
	
}
