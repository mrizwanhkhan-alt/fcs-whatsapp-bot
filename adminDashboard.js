
const http = require("http");

function adminDashboard(req, res) {
  if (req.url !== "/admin") return false;

  res.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8"
  });

  res.end(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <title>FCS Express Admin Dashboard</title>
    </head>
    <body style="font-family:Arial;padding:20px">
      <h2>FCS EXPRESS</h2>
      <h3>Admin Dashboard</h3>
      <p>Dashboard setup ready.</p>
      <p>Applicant management and calling features will be connected separately.</p>
    </body>
    </html>
  `);

  return true;
}

module.exports = { adminDashboard };

