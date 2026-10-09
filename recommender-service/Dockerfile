# Build stage: compile the jar. Tests already ran in CI's own test job before this stage is ever
# reached (see .github/workflows/recommender-deploy.yml) — skip them here, not to avoid testing,
# but to avoid running the whole suite a second time on every deploy.
FROM maven:3.9-eclipse-temurin-17 AS build
WORKDIR /build
COPY .mvn .mvn
COPY pom.xml .
RUN mvn -q dependency:go-offline
COPY src src
RUN mvn -q package -DskipTests

# Runtime stage: a JRE and the one jar. No build tools, no source, no Maven cache — the shipped
# image's attack surface is "a JRE and one jar," nothing else.
FROM eclipse-temurin:17-jre
WORKDIR /app
RUN useradd --system --no-create-home appuser
COPY --from=build /build/target/*.jar app.jar
USER appuser
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]
