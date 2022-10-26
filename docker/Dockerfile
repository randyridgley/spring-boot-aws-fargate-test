FROM public.ecr.aws/ews-network/amazoncorretto:11-alpine
ENV APP_NAME helloWorldWebApp
RUN apk update
RUN apk add --no-cache tini
COPY target/demo-0.0.1-SNAPSHOT.jar /bin/app.jar
VOLUME /bin
EXPOSE 8080
# # use tini to avoid zombie processes and allow better shutdown
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["java", "-jar", "/bin/app.jar"]
