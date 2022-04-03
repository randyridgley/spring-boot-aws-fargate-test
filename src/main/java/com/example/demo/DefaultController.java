package com.example.demo;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/**
 * @author Ivo van der Meer
 */
@RestController
public class DefaultController {

	@GetMapping("/")
	String showIndex(@RequestParam(value = "message", required = false) String message) {
		return "Your message is: " + message;
	}
}
