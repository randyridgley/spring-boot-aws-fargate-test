package com.example.demo.controller;

import com.example.demo.service.TestService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.amazonaws.xray.spring.aop.XRayEnabled;

@RestController
@XRayEnabled
@RequestMapping("/api")
public class TestController {

	@Autowired
	private TestService testService;
	
	@RequestMapping("index")
	public String index() {
		
		testService.test("test_bucket");
		
		return "HERE";
	}
	
}
