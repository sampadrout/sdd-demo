#!/usr/bin/env bash
# Seed ParaBank HSQLDB (create + insert). The official Docker image starts
# HSQL without schema; admin "Initialize" also fails until Parameter exists.
set -euo pipefail

HOST="${PARABANK_DB_HOST:-localhost}"
PORT="${PARABANK_DB_PORT:-9001}"
CONTAINER="${PARABANK_CONTAINER:-parabank}"
WORKDIR="${TMPDIR:-/tmp}/sdd-parabank-seed"
mkdir -p "$WORKDIR"

echo "Copying HSQL driver + SQL from container '${CONTAINER}'..."
docker cp "${CONTAINER}:/usr/local/tomcat/webapps/parabank/WEB-INF/lib/hsqldb-2.7.4.jar" "$WORKDIR/hsqldb.jar"
docker cp "${CONTAINER}:/usr/local/tomcat/webapps/parabank/WEB-INF/classes/com/parasoft/parabank/dao/jdbc/sql/create.sql" "$WORKDIR/create.sql"
docker cp "${CONTAINER}:/usr/local/tomcat/webapps/parabank/WEB-INF/classes/com/parasoft/parabank/dao/jdbc/sql/insert.sql" "$WORKDIR/insert.sql"

cat > "$WORKDIR/Seed.java" <<'EOF'
import java.nio.file.*;
import java.sql.*;

public class Seed {
  public static void main(String[] args) throws Exception {
    String url = args[0];
    Class.forName("org.hsqldb.jdbc.JDBCDriver");
    try (Connection c = DriverManager.getConnection(url, "sa", "")) {
      c.setAutoCommit(true);
      for (int i = 1; i < args.length; i++) {
        String sql = Files.readString(Path.of(args[i]));
        for (String stmt : sql.split(";")) {
          String s = stmt.replaceAll("(?m)^\\s*--.*$", "").trim();
          if (s.isEmpty()) continue;
          try (Statement st = c.createStatement()) {
            st.execute(s);
          } catch (SQLException e) {
            System.out.println("WARN: " + e.getMessage());
          }
        }
      }
    }
    System.out.println("ParaBank DB seeded via " + url);
  }
}
EOF

javac -cp "$WORKDIR/hsqldb.jar" -d "$WORKDIR" "$WORKDIR/Seed.java"
URL="jdbc:hsqldb:hsql://${HOST}:${PORT}/parabank"
echo "Seeding ${URL}..."
java -cp "$WORKDIR:$WORKDIR/hsqldb.jar" Seed "$URL" "$WORKDIR/create.sql" "$WORKDIR/insert.sql"
