FROM adoptopenjdk/openjdk11:alpine-slim
ENV APP_NAME helloWorldWebApp
FROM krallin/ubuntu-tini:trusty
RUN apk update
# install tini
RUN apk add --no-cache tini
COPY target/demo-0.0.1-SNAPSHOT.jar /bin/app.jar
VOLUME /bin
EXPOSE 8080
# use tini to avoid zombie processes and allow better shutdown
ENTRYPOINT ["/usr/local/bin/tini", "-e", "143", "-g", " -- "]
CMD ["java", "-jar", "/bin/app.jar"]
