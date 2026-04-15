FROM maven:3.9-eclipse-temurin-17 AS builder

WORKDIR /app

COPY pom.xml .
RUN mvn dependency:go-offline

COPY src ./src
COPY config/ ./config/

RUN mvn clean package -DskipTests

FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

# Copiar el JAR
COPY --from=builder /app/target/*.jar app.jar

# Copiar la carpeta config completa
COPY --from=builder /app/config ./config

# Definir la ruta absoluta como variable de entorno
ENV FIREBASE_CONFIG_PATH=/app/config/firebase-service-account.json
ENV GOOGLE_APPLICATION_CREDENTIALS=/app/config/firebase-service-account.json

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://localhost:8080/actuator/health || exit 1

ENTRYPOINT ["java", "-jar", "app.jar"]
