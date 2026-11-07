# Build stage. The build context is the repository root so Maven settings can be
# shared with local builds. Choose MAVEN_MIRROR=aliyun in mainland China.
FROM maven:3.9-eclipse-temurin-21 AS build

ARG MAVEN_MIRROR=central
WORKDIR /build

COPY deploy/maven/settings-central.xml deploy/maven/settings-aliyun.xml /build/
COPY backend/pom.xml /build/pom.xml
RUN mvn -B -q -s /build/settings-${MAVEN_MIRROR}.xml dependency:resolve

COPY backend/src /build/src
RUN mvn -B -q -s /build/settings-${MAVEN_MIRROR}.xml -DskipTests package

# Runtime stage: small JRE, non-root user.
FROM eclipse-temurin:21-jre-alpine

RUN addgroup -S wms && adduser -S wms -G wms
WORKDIR /app
COPY --from=build /build/target/genisource-wms-*.jar /app/app.jar

USER wms
EXPOSE 8080
ENTRYPOINT ["java", "-XX:MaxRAMPercentage=75", "-XX:+ExitOnOutOfMemoryError", "-jar", "/app/app.jar"]
