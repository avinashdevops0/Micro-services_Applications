FROM mysql/mysql-server:8.0
COPY init.sql /docker-entrypoint-initdb.d/
EXPOSE 3306
env MYSQL_ROOT_PASSWORD=rootpassword
env MYSQL_USER=bookings_user
env MYSQL_PASSWORD=bookings123