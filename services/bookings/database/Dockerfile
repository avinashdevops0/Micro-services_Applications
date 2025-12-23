FROM mysql/mysql-server:8.0
COPY init.sql /docker-entrypoint-initdb.d/

ENV MYSQL_ROOT_PASSWORD=rootpassword
ENV MYSQL_DATABASE=bookings_db
# ENV MYSQL_ROOT_HOST=%
EXPOSE 3306
