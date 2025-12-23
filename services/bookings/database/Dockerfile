FROM mysql:8.0
COPY init.sql /docker-entrypoint-initdb.d/

ENV MYSQL_ROOT_PASSWORD=rootpassword
ENV MYSQL_DATABASE=bookings_db
ENV MYSQL_ROOT_HOST=%

COPY init.sql /docker-entrypoint-initdb.d/

EXPOSE 3306
