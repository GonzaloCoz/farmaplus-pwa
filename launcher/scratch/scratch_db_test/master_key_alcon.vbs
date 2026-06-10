On Error Resume Next
Dim conn, rs, strConn, sql, output
Set conn = CreateObject("ADODB.Connection")
Set rs = CreateObject("ADODB.Recordset")

' Intentar conexión usando el Provider de MariaDB/MySQL que debe estar instalado por Plex
strConn = "Driver={MariaDB ODBC 3.1 Driver};Server=172.30.40.63;Port=3306;Database=plex;Uid=root;Pwd=plex2014;Trusted_Connection=yes;"

conn.Open strConn

If conn.State = 1 Then
    WScript.Echo "¡CONEXIÓN EXITOSA VÍA ADO!"
    sql = "SELECT p.ean, p.nombre, s.cantidad FROM productos p INNER JOIN laboratorios l ON p.laboratorio_id = l.id INNER JOIN stock s ON p.id = s.producto_id WHERE l.nombre LIKE '%ALCON%' LIMIT 10"
    rs.Open sql, conn
    
    Do Until rs.EOF
        WScript.Echo rs.Fields(0) & " | " & rs.Fields(1) & " | " & rs.Fields(2)
        rs.MoveNext
    Loop
    rs.Close
Else
    WScript.Echo "Error de conexión ADO: " & Err.Description
End If

conn.Close
