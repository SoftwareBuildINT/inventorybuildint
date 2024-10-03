const express = require("express");
const bodyParser = require("body-parser");
const mysql = require("mysql2");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const nodemailer = require("nodemailer");
const randomstring = require("randomstring");
const PDFDocument = require("pdfkit");
const fs = require("fs"); //To read file
const dotenv = require("dotenv");
dotenv.config();
const app = express();
const multer = require("multer");
const excelToJson = require("convert-excel-to-json");
const xlsx = require("xlsx");
const cors = require("cors");
const session = require("express-session");
const path = require("path");
const ExcelJS = require("exceljs");
const bwipjs = require("bwip-js");
const archiver = require("archiver");
const { createCanvas } = require("canvas");
const Barcode = require("jsbarcode");
const qr = require("qrcode");
//const { isWeakMap } = require('util/types');
/// hello

app.use(bodyParser.json());

const corsOptions = {
  origin: "https://inventory.flutterflow.app",
  methods: "GET,PUT,POST,HEAD,PATCH,DELETE",
  preflightContinue: false,
  optionsSuccessStatus: 204,
  allowedHeaders: "Content-Type, Authorization",
};

app.use(cors());
//app.use(cors(corsOptions));
//MySQL connection configuration
const connection = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

app.use(
  session({
    secret: "shubham",
    resave: false,
    saveUninitialized: true,
  })
);

connection.getConnection((err) => {
  if (err) throw err;
  console.log("Connected to MySQL database");
});

//function to verify token
function verifyToken(req, res, next) {
  // Get token from headers, query parameters, or request body
  const token = req.headers["authorization"];

  if (!token) {
    return res.status(403).json({ error: "Token is required" });
  }

  jwt.verify(token, "secretkey", (err, decoded) => {
    if (err) {
      return res.status(401).json({ error: "Failed to authenticate token" });
    }
    req.user_data = decoded;
    console.log(req.user_data);
    next();
  });
}

// Routes
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  // Check if the user exists
  connection.query(
    "SELECT * FROM users WHERE username = ?",
    [username],
    async (err, results) => {
      if (err) {
        console.log(err);
        res.status(500).json({ error: "Internal server error" });
        return;
      }

      if (results.length === 0) {
        res.status(401).json({ error: "Invalid username or password" });
        return;
      }

      const user = results[0];
      console.log(user);

      // Compare entered password with password in database
      const compare = await bcrypt.compare(password, user.password);
      // if (!compare) {
      //     console.log("Unauthorized");
      //     res.status(401).json({ error: "Invalid Password" });
      //     return;
      // }

      if (compare) {
        req.session.user = user;
      } else {
        console.log("Unauthorized");
        res.status(401).json({ error: "Invalid Password" });
        return;
      }

      // User is authenticated; generate a JWT token
      const token = jwt.sign(
        { id: user.id, username: user.username, role: user.role },
        "secretkey",
        {
          // Token expires in 1 hour
        }
      );
      // Update the database with the JWT token
      connection.query(
        "UPDATE users SET token = ? WHERE username = ?",
        [token, user.username],
        (updateErr, updateResults) => {
          if (updateErr) {
            console.log(updateErr);
            res
              .status(500)
              .json({ error: "Failed to update JWT token in the database" });
            return;
          }

          res
            .status(200)
            .json({
              token: token,
              role: user.role,
              first_name: user.first_name,
              user_id: user.id,
            });
        }
      );
    }
  );
});
//To hash password in database
app.post("/hash_password", async (req, res) => {
  try {
    // Get the password from the request body
    const { username, password } = req.body;
    
    // Check if password is provided
    if (!password) {
      return res.status(400).json({ error: "Password not provided" });
    }

    // Hash the password using bcrypt
    const hashedPassword = await bcrypt.hash(password, 10);

    // Log the hashed password to verify
    console.log("Hashed password:", hashedPassword);
    //const user = results[0];

    // Update the database with the hashed password
    connection.query(
      "UPDATE users SET password = ? WHERE username = ?",
      [hashedPassword, username],
      (updateErr, updateResults) => {
        if (updateErr) {
          console.log(updateErr);
          return res
            .status(500)
            .json({
              error: "Failed to update hashed password in the database",
            });
        }

        // Log the update results to verify
        console.log("Update results:", updateResults);

        res.status(200).json({ success: true });
      }
    );
  } catch (error) {
    console.error("Error hashing password:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/added-item-list", (req, res) => {
  //const { item_name } = req.body;

  connection.query(
    "SELECT item_id, item_name, supplier_id, stock_holder_name, stock_holder_contact, stock_status, working_status, rack, slot, added_date FROM stocks_test1 WHERE item_status = 0 OR item_status = 1 ORDER BY added_date desc",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database:", error.stack);
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ items: results });
    }
  );
});

// Function to update quantity in add_item table
function updateQuantityInAddItem(material, quantity) {
  const sql = `UPDATE additem SET quantity = quantity - ? WHERE material = ?`;
  const values = [quantity, material];

  connection.query(sql, values, (err, result) => {
    if (err) {
      console.error("Error updating quantity in add_item table: " + err.stack);
      return;
    }
    console.log("Quantity updated in add_item table");
  });
}

app.post("/create-user", (req, res) => {}); //Current NOT IN WORK

app.get("/stocks", verifyToken, (req, res) => {
  connection.query(
    "SELECT * FROM stocks_test1 WHERE item_status = 1 ORDER BY added_date desc",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database:", error.stack);
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ items: results });
    }
  );
});

app.get("/history", verifyToken, (req, res) => {
  connection.query(
    "SELECT * FROM stocks_test1 WHERE updated_date IS NOT NULL ORDER BY updated_date DESC",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database:", error.stack);
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ items: results });
    }
  );
});

app.get("/profile", verifyToken, (req, res) => {
  const userId = req.session.user.id;
  console.log(userId);
  console.log(req.session.user);
  connection.query(
    "SELECT first_name, role FROM users WHERE id = ?",
    [userId],
    (error, results) => {
      if (error) {
        console.error("Error fetching name from database:", error.stack);
        return res.status(500).json({ error: "Internal server error" });
      }
      if (results.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json({ first_name: results[0].first_name, role: results[0].role });
    }
  );
});

const transporter = nodemailer.createTransport({
  host: "smtp.rediffmailpro.com",
  port: 465,
  secure: true,
  auth: {
    user: "Interns@buildint.co",
    pass: "Interns@2024",
  },
});
app.post("/request-material", (req, res) => {
  const { name, site_name, material, quantity, id } = req.body;

  if (!name || !site_name || !material || !quantity || !id) {
    return res
      .status(400)
      .json({
        error:
          "Missing required fields (name, site_name, material, date_of_request, quantity, user_id)",
      });
  }

  // Fetch user's email from login table
  // connection.query('SELECT email FROM users WHERE id = ?', id, (error, results) => {
  //     if (error) {
  //         console.error('Error fetching user email: ' + error.stack);
  //         return res.status(500).json({ error: 'Internal server error' });
  //     }

  //     if (results.length === 0) {
  //         return res.status(404).json({ error: 'User not found' });
  //     }

  //     const userEmail = results[0].email;

  const uniqueId = generateUniqueId();

  const requestMaterial = {
    id: uniqueId,
    name,
    site_name,
    material,
    quantity,
  };

  connection.query(
    "INSERT INTO requestmaterial SET ?",
    requestMaterial,
    (error, insertResult) => {
      if (error) {
        console.error("Error inserting item into database: " + error.stack);
        return res.status(500).json({ error: "Internal server error" });
      }

      console.log("Item added to database with ID: " + insertResult.insertId);

      // Send email to user
      sendEmail(userEmail, requestMaterial);

      res
        .status(201)
        .json({
          message: "Material requested successfully",
          item: requestMaterial,
        });
    }
  );
});

function sendEmail(email, requestMaterial) {
  const mailOptions = {
    from: "Interns@buildint.co",
    to: email,
    subject: "Approval for requested material",
    text: `Dear Sir/Ma'am,\n\nA request has been raised for a material: ${requestMaterial.material}.\n\nPlease find the details below:\n\nName: ${requestMaterial.name}\nSite Name: ${requestMaterial.site_name}\nMaterial: ${requestMaterial.material}\nProject Name: ${requestMaterial.project_name}\nDescription: ${requestMaterial.description}\nQuantity: ${requestMaterial.quantity}\n\nTo approve the request please visit: https://inventory.flutterflow.app/raisedRequest\n\nThank you.`,
  };

  transporter.sendMail(mailOptions, function (error, info) {
    if (error) {
      console.error("Error sending email: " + error);
    } else {
      console.log("Email sent: " + info.response);
    }
  });
}

app.post("/request-mat", verifyToken, (req, res) => {
  const { name, site_name, material, project_name, description, quantity } =
    req.body;

  const requestmaterial = {
    name,
    site_name,
    material,
    project_name,
    description,
    quantity,
  };

  connection.query(
    "INSERT INTO requestmaterial SET ?",
    requestmaterial,
    (error, results) => {
      if (error) {
        console.error("Error inserting item into database: " + error.stack);
        return res.status(500).json({ error: "Internal server error" });
      }
      console.log("Item added to database with ID: " + results.insertId);

      sendEmail("theo48173@gmail.com", requestmaterial);

      res
        .status(201)
        .json({ message: "Request added successfully", item: requestmaterial });
    }
  );
});

// function generateUniqueId() {
//     const randomNumber = Math.floor(Math.random() * 90000) + 10000; // Generate a random number between 10000 and 99999
//     return randomNumber.toString(); // Convert the number to a string and return
// }

app.get("/raised-request", verifyToken, (req, res) => {
  // 0 = Pending, 1 = Approved, 2 = Declined
  connection.query(
    "SELECT * FROM requestmaterial WHERE approve_status = 0 ORDER BY date_of_request DESC",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database", error.stack);
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ items: results });
    }
  );
});

app.get("/approved-history", verifyToken, (req, res) => {
  connection.query(
    "SELECT * FROM requestmaterial WHERE approve_status = 1",
    (error, results) => {
      if (error) {
        console.error("Error fetching itemrs from database ,error.stack");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ items: results });
    }
  );
});

app.post("/edit-profile", verifyToken, (req, res) => {
  const { username, firstName, lastName, email } = req.body;

  if (!username || !firstName || !lastName || !email) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  connection.query(
    "UPDATE login SET firstName = ?, lastName = ?, email = ? WHERE username = ?",
    [firstName, lastName, email, username],
    (error, results) => {
      if (error) {
        console.error("Error inserting item into database: " + error.stack);
        return res.status(500).json({ error: "Internal server error" });
      }
      console.log("Item added to database with ID: " + results.insertId);
      res.status(201).json({ message: "Profile edited successfully" });
    }
  );
});

app.post("/forgot-password", (req, res) => {
  const { email } = req.body;

  connection.query(
    "SELECT email FROM users WHERE email = ?",
    [email],
    (error, results) => {
      if (error) {
        console.error("Error checking email in database:", error);
        return res.status(500).json({ error: "Database query error" });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: "Email does not exist" });
      }

      // Generate a random OTP
      const otp = randomstring.generate({
        length: 6,
        charset: "numeric",
      });
      const expire_otp = new Date(Date.now() + 600000); //OTP expires in 10 min

      // Create a nodemailer transporter
      const transporter = nodemailer.createTransport({
        host: "smtp.rediffmailpro.com",
        port: 465,
        secure: true,
        auth: {
          user: "trainee.software@buildint.co",
          pass: "BuildINT@123",
        },
      });

      // Email message
      const mailOptions = {
        from: "trainee.software@buildint.co",
        to: email,
        subject: "Your OTP for verification",
        text: `Your OTP is: ${otp}`,
      };

      // Send email with OTP
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("Error sending email:", error);
          return res
            .status(500)
            .json({ error: "Failed to send OTP via email" });
        }
        console.log("Email sent:", info.response);

        //UPDATE the database
        connection.query(
          "UPDATE users SET otp = ?, expire_otp = ? WHERE email = ?",
          [otp, expire_otp, email],
          (error, results) => {
            if (error) {
              console.error("Error storing OTP in database:", error);
              return res
                .status(500)
                .json({ error: "Failed to store OTP in database" });
            }
            console.log("OTP stored in database");
            res
              .status(200)
              .json({ message: "OTP generated and sent via email" });
          }
        );
      });
    }
  );
});

// Endpoint to verify OTP
app.post("/verify-otp", (req, res) => {
  const { email, otp } = req.body;

  connection.query(
    "SELECT otp FROM users WHERE email = ?",
    [email],
    (err, results) => {
      if (err) {
        console.error("Error retrieving OTP:", err);
        return res.status(500).send("Error retrieving OTP");
      }

      if (results.length > 0) {
        const storedOtp = results[0].otp;
        console.log(`Stored OTP: ${storedOtp}, Provided OTP: ${otp}`);

        if (storedOtp === otp) {
          connection.query(
            "UPDATE users SET otp = NULL WHERE email = ?;",
            [email],
            (err) => {
              if (err) {
                console.error("Error deleting OTP:", err);
                return res.status(500).send("Error deleting OTP");
              }
              return res.status(200).send("OTP verified successfully");
            }
          );
        } else {
          console.error("Invalid OTP provided:", otp);
          return res.status(400).send("Invalid OTP");
        }
      } else {
        console.error("No OTP found for the provided email:", email);
        return res.status(400).send("Invalid OTP");
      }
    }
  );
});

//remove item_id from code and database
app.post("/add-po", verifyToken, (req, res) => {
  const { po_code, supplier_id, item_name, quantity, status } = req.body;

  if (!po_code || !supplier_id || !item_name || !quantity || !status) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const po_list = {
    po_code,
    supplier_id,
    item_name,
    quantity,
    status,
  };

  connection.query("INSERT INTO po_list SET ?", po_list, (error, results) => {
    if (error) {
      console.error("Error inserting item into database: " + error.stack);
      return res.status(500).json({ error: "Internal server error" });
    }
    console.log("Item added to database with ID: " + results.insertId);
    res.status(201).json({ message: "P.O. added successfully", item: po_list });
  });
});

app.get("/purchase-order", verifyToken, (req, res) => {
  connection.query(
    "SELECT * FROM po_list WHERE status = 1",
    (error, results) => {
      if (error) {
        console.error("Error fetching itemrs from database ,error.stack");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ items: results });
    }
  );
});

app.post("/add-supplier", verifyToken, (req, res) => {
  const { name, contact_number, address, contact_person, status } = req.body;

  if (!name || !contact_number || !address || !contact_person || !status) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  const suppliers = {
    name,
    contact_number,
    address,
    contact_person,
    status,
  };

  connection.query(
    "INSERT INTO suppliers SET ?",
    suppliers,
    (error, results) => {
      if (error) {
        console.error("Error inserting item into database: " + error.stack);
        return res.status(500).json({ error: "Internal server error" });
      }
      console.log("Item added to database with ID: " + results.insertId);
      res
        .status(201)
        .json({ message: "New supplier added successfully", item: suppliers });
    }
  );
});

app.get("/supplier-list", verifyToken, (req, res) => {
  connection.query(
    "SELECT * FROM suppliers WHERE status = 1 ORDER BY name",
    (error, results) => {
      if (error) {
        console.error("Error fetching itemrs from database ,error.stack");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ items: results });
    }
  );
});

app.post("/send-material", (req, res) => {
  const { material, quantity } = req.body;

  // Check if quantity is provided
  if (!material || !quantity) {
    return res.status(400).json({ error: "Invalid" });
  }

  // Update stocks table
  const updateQuery = `UPDATE additem SET quantity = quantity - ?`;

  connection.query(updateQuery, quantity, (err, result) => {
    if (err) {
      console.error("Error updating stocks table: " + err.stack);
      return res.status(500).json({ error: "Internal server error." });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "No rows updated." });
    }

    res.json({ message: "Material sent successfully." });
  });
});

app.get("/inwards", verifyToken, (req, res) => {
  connection.query(
    "SELECT count(item_status) as Inwards FROM stocks_test1 WHERE item_status = 0;",
    (error, results) => {
      if (error) {
        console.error("Error fetching itemrs from database ,error.stack");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.send(results);
    }
  );
});

app.get("/outwards", verifyToken, (req, res) => {
  connection.query(
    "SELECT count(item_status) as Outward FROM stocks_test1 WHERE item_status = 1;",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database ,error.stack");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ items: results });
    }
  );
});

function generatePDF(data, userChalanId) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: [595.28, 955.89] });
    const buffers = [];
    doc.on("data", (buffer) => buffers.push(buffer));
    doc.on("end", () => {
      const pdfData = Buffer.concat(buffers);
      resolve(pdfData);
    });

    // Filter data by the user's chalan_id
    const filteredData = data.filter((row) => row.chalan_id === userChalanId);

    let totalCost = 0; // Initialize total cost variable

    data.forEach((row) => {
      doc.rect(50, 50, 514, 700).stroke();
      doc.image("./buildint.png", 457, 55, { width: 100, height: 25 });
      doc
        .font("Times-Bold")
        .fontSize(14)
        .text("DELIVERY CHALLAN", 55, 115, {
          width: 504,
          height: 35,
          align: "left",
        });
      doc
        .font("Times-Bold")
        .fontSize(14)
        .text("Lightforce Buildint Pvt Ltd", 55, 130, {
          width: 504,
          height: 35,
          align: "left",
        });
      doc
        .font("Times-Bold")
        .fontSize(10)
        .text("408-412, Srishti Palza, Off Saki Vihar Road,", 55, 147, {
          width: 504,
          height: 35,
          align: "left",
        });
      doc
        .font("Times-Bold")
        .fontSize(10)
        .text("Powai, Mumbai 400072", 55, 160, {
          width: 504,
          height: 35,
          align: "left",
        });
      doc.rect(50, 180, 514, 40).stroke();
      doc
        .font("Times-Bold")
        .fontSize(25)
        .text("Delivery Challan ", 165, 195, {
          width: 280,
          height: 5,
          align: "center",
        });
      doc.rect(50, 220, 257, 25).stroke();
      doc
        .font("Times-Bold")
        .fontSize(15)
        .text(`Challan Id :  ${row.chalan_id}`, 55, 230, {
          width: 280,
          height: 5,
          align: "left",
        });
      doc.rect(306, 220, 257, 25).stroke();
      doc
        .font("Times-Bold")
        .fontSize(14)
        .text(`Challan Date:  ${row.updated_date}`, 310, 230, {
          width: 280,
          height: 5,
          align: "left",
        });
      doc.rect(50, 245, 257, 25).stroke();
      doc
        .font("Times-Bold")
        .fontSize(15)
        .text(`Contact Person :  ${row.reciever_name}`, 55, 252, {
          width: 280,
          height: 5,
          align: "left",
        });
      doc.rect(306, 245, 257, 25).stroke();
      doc
        .font("Times-Bold")
        .fontSize(15)
        .text(`Contact Number :  ${row.reciever_contact}`, 310, 252, {
          width: 280,
          height: 5,
          align: "left",
        });
      doc.rect(50, 270, 257, 25).stroke();
      doc
        .font("Times-Bold")
        .fontSize(15)
        .text("ATM ID :  ", 55, 275, { width: 280, height: 5, align: "left" });
      doc.rect(306, 270, 257, 25).stroke();
      doc
        .font("Times-Bold")
        .fontSize(15)
        .text("HPY Code :  ", 310, 275, {
          width: 280,
          height: 5,
          align: "left",
        });
      doc.rect(50, 295, 257, 25).stroke();
      doc
        .font("Times-Bold")
        .fontSize(15)
        .text("Reverse Charge :  ", 55, 300, {
          width: 280,
          height: 5,
          align: "left",
        });
      doc.rect(306, 295, 257, 25).stroke();
      doc
        .font("Times-Bold")
        .fontSize(15)
        .text("Reverse Charge  :  ", 310, 300, {
          width: 280,
          height: 5,
          align: "left",
        });

      doc.rect(50, 320, 257, 65).stroke();
      doc
        .font("Times-Bold")
        .fontSize(15)
        .text("Billed To :  ", 55, 325, {
          width: 280,
          height: 5,
          align: "left",
        });
      doc
        .font("Times-Bold")
        .fontSize(12)
        .text("Name :  Lightforce Buildint Pvt Ltd", 55, 345, {
          width: 280,
          height: 5,
          align: "left",
        });
      doc
        .font("Times-Bold")
        .fontSize(12)
        .text("408-412, Srishti Palaza, Off Saki Vihar Road");
      doc.font("Times-Bold").fontSize(12).text("Powai, Mumbai 400076");
      doc.rect(306, 320, 257, 65).stroke();
      doc
        .font("Times-Bold")
        .fontSize(15)
        .text(`Shipped To :  ${row.reciever_name}`, 310, 325, {
          width: 280,
          height: 5,
          align: "left",
        });
      doc
        .font("Times-Bold")
        .fontSize(12)
        .text(`Name :  ${row.Location}`, 310, 345, {
          width: 280,
          height: 5,
          align: "left",
        });
      doc.rect(50, 385, 50, 25).stroke();

      doc
        .font("Times-Bold")
        .fontSize(10)
        .text("SR. NO: ", 53, 395, { width: 280, height: 5, align: "left" });
      doc.rect(100, 385, 207, 25).stroke();
      doc.font("Times-Bold").fontSize(10).text("1", 53, 420);
      doc
        .font("Times-Bold")
        .fontSize(10)
        .text(`Description of Goods:  `, 150, 395, {
          width: 280,
          height: 5,
          align: "left",
        });
      doc.rect(306, 385, 50, 25).stroke();

      let startY = 420;
      const lineHeight = 12;

      data.forEach((row) => {
        doc.font("Times-Bold").fontSize(10).text(row.item_name, 120, startY);
        startY += lineHeight; // Move down for the next item
        //totalCost += Number(row.cost);
      });

      doc
        .font("Times-Bold")
        .fontSize(10)
        .text("Qty  ", 315, 395, { width: 280, height: 5, align: "left" });
      doc.rect(356, 385, 207, 25).stroke();
      doc.font("Times-Bold").fontSize(10).text(`${row.item_status}`, 315, 420);
      doc
        .font("Times-Bold")
        .fontSize(10)
        .text("Approx Amount  ", 420, 395, {
          width: 280,
          height: 5,
          align: "left",
        });
      doc.rect(50, 410, 50, 150).stroke();

      let start = 420;
      const lineH = 12;

      data.forEach((row) => {
        doc.font("Times-Bold").fontSize(10).text(row.cost, 400, start);
        start += lineH; // Move down for the next item
      });
      //doc.font('Times-Bold').fontSize(10).text(`${row.cost}`, 400, 420)

      doc.rect(100, 410, 207, 150).stroke();
      doc.rect(306, 410, 207, 150).stroke();
      doc.rect(356, 410, 207, 150).stroke();
      doc.rect(50, 560, 50, 20).stroke();
      doc.rect(100, 560, 207, 20).stroke();
      doc.font("Times-Bold").fontSize(10).text(`${totalCost}`, 450, start);
      doc
        .font("Times-Bold")
        .fontSize(10)
        .text("Total:", 140, 565, { width: 280, height: 5, align: "center" });
      doc.rect(306, 560, 207, 20).stroke();
      doc.rect(356, 560, 207, 20).stroke();
      doc.rect(50, 580, 514, 30).stroke();
      doc
        .font("Times-Bold")
        .fontSize(10)
        .text(
          "If any difference is found in quantity, quality and rate etc. it should be notified in writing withing 24 Hours. No claim will be entertained thereafter",
          52,
          585
        );
      doc
        .font("Times-Bold")
        .fontSize(10)
        .text("For LIGHTFORCE BUILDINT PRIVATE LIMITED", 52, 615);
      doc.image("./sign.png", 60, 630, { width: 112, height: 80 });
      doc.font("Times-Bold").fontSize(10).text("Authorized Signatory", 60, 720);
      doc
        .font("Times-Bold")
        .fontSize(10)
        .text("Received By : _____________", 240, 720, {
          width: 280,
          height: 5,
          align: "right",
        });
    });
    // Finalize the PDF and close the stream
    doc.end();
  });
}

app.get("/generatepdf", async (req, res) => {
  try {
    console.log("inside try block");
    const { chalan_id } = req.query;
    const query = "SELECT * FROM stocks_test1 WHERE chalan_id = ?";
    const values = [chalan_id];
    const results = {};

    async function executeQuery(query, value, key) {
      console.log("inside asyn block");
      return new Promise((resolve, reject) => {
        connection.query(query, value, (err, result) => {
          if (err) {
            console.log("data not found");
            reject(err);
          } else {
            results[key] = result;
            console.log("data generated", results);
            resolve();
          }
        });
      });
    }

    const promises = [executeQuery(query, values, "chalan_id")];
    await Promise.all(promises);

    const data = results.chalan_id;
    if (data.length === 0) {
      return res.status(404).json({ message: "No data found" });
    }

    const pdfData = await generatePDF(data);
    res.setHeader("Content-Disposition", 'attachment; filename="challan.pdf"');
    res.setHeader("Content-Type", "application/pdf");
    res.status(200).end(pdfData);
    console.log("test1");
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/send-material-history", verifyToken, (req, res) => {
  connection.query(
    "SELECT * FROM stocks_test1 WHERE item_status = 1 ORDER BY updated_date DESC",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database ");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ history: results });
    }
  );
});

app.get("/out-of-stock", verifyToken, (req, res) => {
  connection.query(
    "SELECT count(item_name) out_of_stock FROM inventory.additem where quantity = 0",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database ");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ Count: results });
    }
  );
});

app.post("/get-report", verifyToken, (req, res) => {
  console.log(req.body);
  const { in_out, site_details, product_name, from_date, to_date } = req.body;
  console.log(in_out);
  console.log(site_details);
  console.log(product_name);
  console.log(from_date);
  console.log(to_date);

  const query = ``;

  connection.query(
    "SELECT * FROM history where site_details = ? AND product_name =? AND in_out = ? AND date BETWEEN ? and ?;",
    [site_details, product_name, in_out, from_date, to_date],
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database ");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json(results);
    }
  );
});

app.get("/status-active", verifyToken, (req, res) => {
  connection.query(
    "SELECT COUNT(status) FROM polist WHERE status = 'active'",
    (error, results) => {
      if (error) {
        console.error("Error fetching itemrs from database ,error.stack");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.send(results);
    }
  );
});

app.get("/status-pending", verifyToken, (req, res) => {
  connection.query(
    "SELECT COUNT(status) FROM polist WHERE status = 'pending'",
    (error, results) => {
      if (error) {
        console.error("Error fetching itemrs from database ,error.stack");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.send(results);
    }
  );
});

app.get("/req-status", verifyToken, (req, res) => {
  connection.query(
    "SELECT COUNT(approve_status) FROM requestmaterial WHERE approve_status = 'pending'",
    (error, results) => {
      if (error) {
        console.error("Error fetching itemrs from database ,error.stack");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.send(results);
    }
  );
});

//Added on 17.04.2024
//add project
app.post("/add-project", verifyToken, (req, res) => {
  const { name, created_by } = req.body;

  // Check if all required fields are present
  if (!name || !created_by) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  const query = `INSERT INTO projects (name, created_by) VALUES (?, ?)`;

  // Execute the query
  connection.query(query, [name, created_by], (error, results) => {
    if (error) {
      console.error("Error executing query:", error);
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    // Data inserted successfully
    res.status(201).json({ message: "Record inserted successfully" });
  });
});

//to see projects for drop down on send material
app.get("/projects", verifyToken, (req, res) => {
  connection.query("SELECT id,name FROM projects", (error, results) => {
    if (error) {
      console.error("Error fetching itemrs from database ,error.stack");
      return res.status(500).json({ error: "Internal server error" });
    }
    res.json({ items: results });
  });
});

//Added on 18.04.2024
// To update database for sent materials
app.post("/send-material-ok", verifyToken, (req, res) => {
  const {
    project_name,
    item_id,
    item_name,
    cost,
    reciever_name,
    reciever_contact,
    Location,
    chalan_id,
    description,
    m_o_d,
  } = req.body;

  // const id = req.params.id;

  const item_status = 1;
  let values = [
    item_status,
    item_name,
    project_name,
    cost,
    reciever_name,
    reciever_contact,
    Location,
    chalan_id,
    description,
    m_o_d,
    item_id,
  ];

  const query = `UPDATE stocks_test1 SET item_status = ?, item_name=?, project_name=?, cost=?, reciever_name=?, reciever_contact=?, Location=?, chalan_id=?, description=?, m_o_d=? WHERE item_id=?`;

  connection.query(query, values, (error, results) => {
    if (error) {
      console.error("Error executing query:", error);
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    if (results.affectedRows === 0) {
      res.status(404).json({ error: "Record not found" });
      return;
    }

    // Data updated successfully
    res.status(200).json({ message: "Record updated successfully" });
  });
});

app.post("/send-material-ooo", (req, res) => {
  const {
    quantity,
    project_name,
    item_id,
    item_name,
    cost,
    reciever_name,
    reciever_contact,
    Location,
    chalan_id,
    description,
    m_o_d,
  } = req.body;

  if (
    !quantity ||
    !Array.isArray(item_id) ||
    item_id.length === 0 ||
    !Array.isArray(item_name) ||
    item_name.length === 0 ||
    !Array.isArray(cost) ||
    cost.length === 0
  ) {
    return res
      .status(400)
      .json({
        error:
          "Quantity and item details (item_id, item_name, cost) are required and must be arrays.",
      });
  }

  if (item_id.length !== item_name.length || item_id.length !== cost.length) {
    return res
      .status(400)
      .json({
        error:
          "Item details arrays (item_id, item_name, cost) must have the same length.",
      });
  }

  const item_status = 1;

  const updateRecord = (index, callback) => {
    if (index >= item_id.length * quantity) {
      return callback(null);
    }

    const currentItemIndex = Math.floor(index / quantity);
    const currentItemID = item_id[currentItemIndex];
    const currentItemName = item_name[currentItemIndex];
    const currentCost = cost[currentItemIndex];

    const query = `UPDATE stocks_test1 SET updated_date = CURRENT_TIMESTAMP, item_status = ?, item_name = ?, project_name = ?, cost = ?, reciever_name = ?, reciever_contact = ?, Location = ?, chalan_id = ?, description = ?, m_o_d = ? WHERE item_id = ?`;
    const values = [
      item_status,
      currentItemName,
      project_name,
      currentCost,
      reciever_name,
      reciever_contact,
      Location,
      chalan_id,
      description,
      m_o_d,
      currentItemID,
    ];

    connection.query(query, values, (error, results) => {
      if (error) {
        return callback(error);
      }

      if (results.affectedRows === 0) {
        return callback(new Error("Record not found"));
      }

      updateRecord(index + 1, callback);
    });
  };

  updateRecord(0, (error) => {
    if (error) {
      console.error("Error executing query:", error);
      return res
        .status(500)
        .json({ error: "Internal server error", details: error.message });
    }

    res.status(200).json({ message: "Records updated successfully" });
  });
});

app.post("/send-material-new", (req, res) => {
  const {
    quantity,
    project_name,
    item_id,
    item_name,
    cost,
    reciever_name,
    reciever_contact,
    Location,
    chalan_id,
    description,
    m_o_d,
  } = req.body;

  if (
    !quantity ||
    !Array.isArray(item_id) ||
    item_id.length === 0 ||
    !Array.isArray(item_name) ||
    item_name.length === 0 ||
    !Array.isArray(cost) ||
    cost.length === 0
  ) {
    return res
      .status(400)
      .json({
        error:
          "Quantity and item details (item_id, item_name, cost) are required and must be arrays.",
      });
  }

  if (item_id.length !== item_name.length || item_id.length !== cost.length) {
    return res
      .status(400)
      .json({
        error:
          "Item details arrays (item_id, item_name, cost) must have the same length.",
      });
  }

  const item_status = 1;

  const updateRecord = (index, callback) => {
    if (index >= item_id.length * quantity) {
      return callback(null);
    }

    // Calculate the current item ID based on index
    const currentItemIndex = Math.floor(index / quantity);
    const uniqueIndex = index % quantity; // unique index for this item

    const currentItemID = item_id[currentItemIndex];
    const currentItemName = item_name[currentItemIndex];
    const currentCost = cost[currentItemIndex];

    const query = `UPDATE stocks_test1 SET item_status = ?, item_name = ?, project_name = ?, cost = ?, reciever_name = ?, reciever_contact = ?, Location = ?, chalan_id = ?, description = ?, m_o_d = ? WHERE item_id = ?`;
    const values = [
      item_status,
      currentItemName,
      project_name,
      currentCost,
      reciever_name,
      reciever_contact,
      Location,
      chalan_id,
      description,
      m_o_d,
      currentItemID,
    ];

    connection.query(query, values, (error, results) => {
      if (error) {
        return callback(error);
      }

      if (results.affectedRows === 0) {
        return callback(new Error("Record not found"));
      }

      updateRecord(index + 1, callback);
    });
  };

  updateRecord(0, (error) => {
    if (error) {
      console.error("Error executing query:", error);
      return res
        .status(500)
        .json({ error: "Internal server error", details: error.message });
    }

    res.status(200).json({ message: "Records updated successfully" });
  });
});

// For adding items into stocks table (add-item)
app.post("/api/add-item", (req, res) => {
  const {
    item_id,
    item_name,
    make,
    mac_id,
    supplier_id,
    stock_holder_name,
    stock_holder_contact,
    stock_status,
    working_status,
    rack,
    slot,
  } = req.body;

  // Check if all required fields are present
  if (
    !item_id ||
    !item_name ||
    !supplier_id ||
    !stock_holder_name ||
    !stock_holder_contact ||
    !stock_status ||
    !working_status ||
    !rack ||
    !slot
  ) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

  // Check if the item_id already exists
  const checkQuery = "SELECT * FROM stocks_test1 WHERE item_id = ?";
  connection.query(checkQuery, [item_id], (checkError, checkResults) => {
    if (checkError) {
      console.error("Error executing query:", checkError);
      res.status(500).json({ error: "Internal server error" });
      return;
    }

    if (checkResults.length > 0) {
      // item_id already exists
      res.status(409).json({ error: "Item ID already exists" });
      return;
    }

    // Create a SQL query to insert data into the database
    const query = `INSERT INTO stocks_test1 (item_id, item_name, make, mac_id, supplier_id, stock_holder_name, stock_holder_contact, stock_status, working_status, rack, slot ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? )`;

    // Execute the query
    connection.query(
      query,
      [
        item_id,
        item_name,
        make,
        mac_id,
        supplier_id,
        stock_holder_name,
        stock_holder_contact,
        stock_status,
        working_status,
        rack,
        slot,
      ],
      (error, results) => {
        if (error) {
          console.error("Error executing query:", error);
          res.status(500).json({ error: "Internal server error" });
          return;
        }

        // Data inserted successfully
        res.status(201).json({ message: "Item inserted successfully" });
      }
    );
  });
});

// app.post("/api/add-item-ooo", (req, res) => {
//     const { quantity, stock_holder_name, stock_holder_contact, stock_status, rack, slot, supplier_id, item_name, item_id, make, mac_id, working_status } = req.body;

//     console.log("Data from body", req.body)
//     console.log("Item name", item_name)

//     // Validate required fields
//     if (!quantity || !supplier_id || !stock_holder_name || !stock_holder_contact || !stock_status || !rack || !slot || !item_id || !item_name || !working_status) {
//         res.status(400).json({ error: "Missing required fields" });
//         return;
//     }

//     if (!Array.isArray(item_id) || item_id.length === 0) {
//         res.status(400).json({ error: "item_id should be a non-empty array" });
//         return;
//     }

//     // Initialize an array to collect errors
//     let insertionErrors = [];
//     let itemsProcessed = 0;

//     // Iterate over the item_id array and check existence before insertion
//     item_id.forEach((currentItemId, index) => {
//         const currentItemName = item_name[index];
//         const currentMake = make[index];
//         const currentMacId = mac_id[index];
//         const currentWorkingStatus = working_status[index];

//         // if (!currentItemId || !currentItemName || !currentMake || !currentMacId || !currentWorkingStatus) {
//         //     insertionErrors.push({ item_id: currentItemId, error: "Missing required item fields" });
//         //     return;
//         // }

//         // For testing purpose
//         if (!currentItemId) {
//             console.log("Missing field: item_id");
//             insertionErrors.push({ item_id: currentItemId, error: "Missing required item_id" });
//         }

//         if (!currentItemName) {
//             console.log("Missing field: item_name");
//             insertionErrors.push({ item_id: currentItemId, error: "Missing required item_name" });
//         }

//         if (!currentMake) {
//             console.log("Missing field: make");
//             insertionErrors.push({ item_id: currentItemId, error: "Missing required make" });
//         }

//         if (!currentMacId) {
//             console.log("Missing field: mac_id");
//             insertionErrors.push({ item_id: currentItemId, error: "Missing required mac_id" });
//         }

//         if (!currentWorkingStatus) {
//             console.log("Missing field: working_status");
//             insertionErrors.push({ item_id: currentItemId, error: "Missing required working_status" });
//         }

//         // if (!currentItemId || !currentItemName || !currentMake || !currentMacId || !currentWorkingStatus) {
//         //     return;
//         // }

//         //
//         // Check if the item_id already exists in the database
//         const checkQuery = 'SELECT * FROM stocks WHERE item_id = ?';
//         connection.query(checkQuery, [currentItemId], (checkError, checkResults) => {
//             if (checkError) {
//                 console.error(`Error checking item_id ${currentItemId}:`, checkError);
//                 insertionErrors.push({ item_id: currentItemId, error: "Database check error" });
//                 itemsProcessed++;
//                 if (itemsProcessed === item_id.length) {
//                     sendFinalResponse();
//                 }
//                 return;
//             }

//             if (checkResults.length > 0) {
//                 // item_id already exists
//                 insertionErrors.push({ item_id: currentItemId, error: "Item ID already exists" });
//                 itemsProcessed++;
//                 if (itemsProcessed === item_id.length) {
//                     sendFinalResponse();
//                 }
//             } else {
//                 // Proceed with insertion since item_id does not exist
//                 const insertQuery = `
//                     INSERT INTO stocks
//                     (item_id, item_name, make, mac_id, supplier_id, stock_holder_name, stock_holder_contact, stock_status, working_status, rack, slot)
//                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
//                 `;
//                 const queryValues = [currentItemId, currentItemName, currentMake, currentMacId, supplier_id, stock_holder_name, stock_holder_contact, stock_status, currentWorkingStatus, rack, slot];

//                 connection.query(insertQuery, queryValues, (insertError, results) => {
//                     itemsProcessed++;
//                     if (insertError) {
//                         console.error(`Error inserting item with ID ${currentItemId}:`, insertError);
//                         insertionErrors.push({ item_id: currentItemId, error: "Database insertion error" });
//                     }
//                     if (itemsProcessed === item_id.length) {
//                         sendFinalResponse();
//                     }
//                 });
//             }
//         });
//     });

//     console.log("All errors", insertionErrors);

//     // Function to send the final response after all items are processed
//     function sendFinalResponse() {
//         if (insertionErrors.length > 0) {
//             res.status(207).json({ message: "Some items could not be inserted", errors: insertionErrors });
//         } else {
//             res.status(201).json({ message: "All items inserted successfully" });
//         }
//     }
// });

app.post("/api/add-item-oooo", async (req, res) => {
  const {
    quantity,
    stock_holder_name,
    stock_holder_contact,
    stock_status,
    rack,
    slot,
    supplier_id,
    item_name,
    item_id,
    make,
    mac_id,
    working_status,
  } = req.body;

  // Validate required fields
  if (
    !quantity ||
    !supplier_id ||
    !stock_holder_name ||
    !stock_holder_contact ||
    !stock_status ||
    !rack ||
    !slot ||
    !Array.isArray(item_id) ||
    item_id.length === 0
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  }

  let insertionErrors = [];
  let itemsProcessed = 0;

  const insertPromises = item_id.map(async (currentItemId, index) => {
    const currentItemName = item_name[index];
    const currentMake = make[index];
    const currentMacId = mac_id[index];
    const currentWorkingStatus = working_status[index];

    if (
      !currentItemId ||
      !currentItemName ||
      !currentMake ||
      !currentMacId ||
      !currentWorkingStatus
    ) {
      insertionErrors.push({
        item_id: currentItemId,
        error: "Missing required item fields",
      });
      itemsProcessed++;
      return;
    }

    try {
      const [checkResults] = await connection
        .promise()
        .query("SELECT * FROM stocks_test1 WHERE item_id = ?", [currentItemId]);
      if (checkResults.length > 0) {
        insertionErrors.push({
          item_id: currentItemId,
          error: "Item ID already exists",
        });
      } else {
        const insertQuery = `
                    INSERT INTO stocks_test1 
                    (item_id, item_name, make, mac_id, supplier_id, stock_holder_name, stock_holder_contact, stock_status, working_status, rack, slot) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `;
        const queryValues = [
          currentItemId,
          currentItemName,
          currentMake,
          currentMacId,
          supplier_id,
          stock_holder_name,
          stock_holder_contact,
          stock_status,
          currentWorkingStatus,
          rack,
          slot,
        ];
        await connection.promise().query(insertQuery, queryValues);
      }
    } catch (error) {
      console.error(`Error processing item with ID ${currentItemId}:`, error);
      insertionErrors.push({ item_id: currentItemId, error: "Database error" });
    } finally {
      itemsProcessed++;
    }
  });

  await Promise.all(insertPromises);

  if (insertionErrors.length > 0) {
    res
      .status(207)
      .json({
        message: "Some items could not be inserted",
        errors: insertionErrors,
      });
  } else {
    res.status(201).json({ message: "All items inserted successfully" });
  }
});

app.post("/api/add-item-ooo", (req, res) => {
  const {
    quantity,
    stock_holder_name,
    stock_holder_contact,
    rack,
    slot,
    supplier_id,
    item_name,
  } = req.body;

  console.log("Data from body", req.body);
  // console.log("Item name", item_name);

  // Validate required fields
  if (
    !quantity ||
    !supplier_id ||
    !stock_holder_name ||
    !stock_holder_contact ||
    !rack ||
    !slot ||
    !item_name
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  } else {
    let query = `SELECT item_id FROM inventory.stocks_test1 WHERE item_name = ? ORDER BY 1 DESC LIMIT 1;`;
    connection.query(query, [item_name], (error, result) => {
      if (error) {
        console.log("Error fetching item name details.");
        return res.status(500).json({ error: error });
      } else if (result.length === 0) {
        // No existing item_id found, start from 01
        const newBaseItemId = `LBPL/Aug-24/01/SIFA/${item_name}`;
        let values = [];

        for (let i = 1; i <= quantity; i++) {
          const itemId = `LBPL/Aug-24/${String(i).padStart(
            2,
            "0"
          )}/SIFA/${item_name}`;
          console.log("New item ids", itemId);
          values.push([
            itemId,
            item_name,
            supplier_id,
            stock_holder_name,
            stock_holder_contact,
            rack,
            slot,
          ]);
        }

        const insertQuery = `INSERT INTO inventory.stocks_test1 
                                     (item_id, item_name, supplier_id, stock_holder_name, stock_holder_contact, rack, slot) 
                                     VALUES ?`;

        connection.query(insertQuery, [values], (error) => {
          if (error) {
            console.log("Error inserting new items.");
            return res.status(500).json({ error: error });
          }
          return res.status(200).json({ message: "Items added successfully!" });
        });
      } else {
        // Existing item_id found, increment the last number
        let lastItemId = result[0].item_id;
        let lastNumber = parseInt(lastItemId.split("/")[2]);
        let values = [];

        console.log("Last item id", lastItemId);
        console.log("Last item number", lastNumber);

        for (let i = 1; i <= quantity; i++) {
          const newItemNumber = lastNumber + i;
          const newItemId = `LBPL/Aug-24/${String(newItemNumber).padStart(
            2,
            "0"
          )}/SIFA/${item_name}`;
          console.log("New item id from previous data", newItemId);

          values.push([
            newItemId,
            item_name,
            supplier_id,
            stock_holder_name,
            stock_holder_contact,
            rack,
            slot,
          ]);
        }

        const insertQuery = `INSERT INTO inventory.stocks_test1 
                                     (item_id, item_name, supplier_id, stock_holder_name, stock_holder_contact, rack, slot) 
                                     VALUES ?`;

        connection.query(insertQuery, [values], (error) => {
          if (error) {
            console.log("Error inserting new items.");
            return res.status(500).json({ error: error });
          }
          return res.status(200).json({ message: "Items added successfully!" });
        });
      }
    });
  }
});

// test 2

//Made based on existing Inventory table naming format for item_id
app.post("/api/add-item-new", (req, res) => {
  const {
    quantity,
    stock_holder_name,
    stock_holder_contact,
    rack,
    slot,
    supplier_id,
    item_name,
    added_by,
  } = req.body;

  console.log("Data from body", req.body);
  // console.log("Item name", item_name);

  // Validate required fields
  if (
    !quantity ||
    !supplier_id ||
    !stock_holder_name ||
    !stock_holder_contact ||
    !rack ||
    !slot ||
    !item_name ||
    !added_by
  ) {
    return res.status(400).json({ error: "Missing required fields" });
  } else {
    let query = `SELECT item_id FROM stocks_test1 WHERE item_name = ? ORDER BY added_date DESC LIMIT 1;`;
    connection.query(query, [item_name], (error, result) => {
      if (error) {
        console.log("Error fetching item name details.");
        return res.status(500).json({ error: error });
      } else if (result.length === 0) {
        // No existing item_id found, start from 01
        const newBaseItemId = `LBPL/24-25/${item_name}/01`;
        let values = [];

        for (let i = 1; i <= quantity; i++) {
          const itemId = `LBPL/24-25/${item_name}/${String(i).padStart(
            2,
            "0"
          )}`;
          console.log("New item ids", itemId);
          values.push([
            itemId,
            item_name,
            supplier_id,
            stock_holder_name,
            stock_holder_contact,
            rack,
            slot,
            added_by
          ]);
        }

        const insertQuery = `INSERT INTO inventory.stocks_test1 
                                     (item_id, item_name, supplier_id, stock_holder_name, stock_holder_contact, rack, slot, added_by) 
                                     VALUES ?`;

        connection.query(insertQuery, [values], (error) => {
          if (error) {
            console.log("Error inserting new items.");
            return res.status(500).json({ error: error });
          }
          return res.status(200).json({ message: "Items added successfully!" });
        });
      } else {
        // Existing item_id found, increment the last number
        let lastItemId = result[0].item_id;
        let lastNumber = parseInt(lastItemId.split("/")[3]);
        let values = [];

        console.log("Last item id", lastItemId);
        console.log("Last item number", lastNumber);

        for (let i = 1; i <= quantity; i++) {
          const newItemNumber = lastNumber + i;
          const newItemId = `LBPL/24-25/${item_name}/${String(
            newItemNumber
          ).padStart(2, "0")}`;
          console.log("New item id from previous data", newItemId);

          values.push([
            newItemId,
            item_name,
            supplier_id,
            stock_holder_name,
            stock_holder_contact,
            rack,
            slot,
            added_by
          ]);
        }

        const insertQuery = `INSERT INTO inventory.stocks_test1 
                                     (item_id, item_name, supplier_id, stock_holder_name, stock_holder_contact, rack, slot, added_by) 
                                     VALUES ?`;

        connection.query(insertQuery, [values], (error) => {
          if (error) {
            console.log("Error inserting new items.");
            return res.status(500).json({ error: error });
          }
          return res.status(200).json({ message: "Items added successfully!" });
        });
      }
    });
  }
});

app.get("/supplier-dropdown", (req, res) => {
  connection.query(
    "SELECT distinct name, id FROM suppliers",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database ");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ users: results });
    }
  );
});

app.get("/item-dropdown", (req, res) => {
  connection.query(
    "SELECT distinct item_name FROM stocks_test1",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database ");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ users: results });
    }
  );
});
//stocks_test1 is my main table in
app.get("/stock-count", verifyToken, (req, res) => {
  connection.query(
    "SELECT distinct item_name, COUNT(item_name) AS quantity FROM stocks_test1 WHERE item_status = 0 OR item_status = 1 OR item_status = 5 GROUP BY item_name ORDER BY item_name ASC;",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database ");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ results });
    }
  );
});

app.post("/delete-po", (req, res) => {
  const { id } = req.body;

  // Update status of query in database
  const sql = `UPDATE po_list SET status = 2 WHERE id = ?`;

  connection.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error updating query status: ", err);
      return res.status(500).json({ message: "Error updating query status" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Query not found" });
    }

    console.log("Query status updated successfully");
    res.status(200).json({ message: "Query status updated successfully" });
  });
});

app.post("/accept-po", (req, res) => {
  const { id } = req.body;

  // Update status of query in database
  const sql = `UPDATE po_list SET status = 3 WHERE id = ?`;

  connection.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error updating query status: ", err);
      return res.status(500).json({ message: "Error updating query status" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Query not found" });
    }

    console.log("Query status updated successfully");
    res.status(200).json({ message: "Query status updated successfully" });
  });
});

app.post("/delete-supplier", (req, res) => {
  // const allowedRoles = ["Admin"];

  // if (!allowedRoles.includes(req.user_data.role)) {
  //     return res
  //         .status(403)
  //         .json({ error: "Permission denied. Insufficient role." });
  // }

  const { id } = req.body;

  // Update status of query in database
  const sql = `UPDATE suppliers SET status = 2 WHERE id = ?`;

  connection.query(sql, [id], (err, result) => {
    if (err) {
      console.error("Error updating query status: ", err);
      return res.status(500).json({ message: "Error updating query status" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Query not found" });
    }

    console.log("Query status updated successfully");
    res.status(200).json({ message: "Query status updated successfully" });
  });
});

app.put("/toggle", (req, res) => {
  // Extract the ID from the request body
  const { id } = req.body;
  // Ensure ID is provided
  if (!id) {
    return res
      .status(400)
      .json({ error: "ID is required in the request body" });
  }

  // Get the current status
  connection.query(
    "SELECT status FROM suppliers WHERE id = ? LIMIT 1",
    [id],
    (error, results) => {
      if (error) {
        console.error("Error getting current status:", error);
        return res.status(500).json({ error: "Internal Server Error" });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: "Supplier not found" });
      }

      const currentStatus = results[0].status;
      const newStatus = currentStatus === 1 ? 0 : 1;

      // Toggle the status value
      connection.query(
        "UPDATE suppliers SET status = ? WHERE id = ?",
        [newStatus, id],
        (error) => {
          if (error) {
            console.error("Error updating status:", error);
            return res.status(500).json({ error: "Internal Server Error" });
          }
          res.json({
            message: "Status toggled successfully",
            status: newStatus,
          });
        }
      );
    }
  );
});

app.post("/change-password", verifyToken, (req, res) => {
  const { currentPassword, newPassword, confirmPassword, id } = req.body;

  // Check if new password and confirm password match
  if (newPassword !== confirmPassword) {
    return res
      .status(400)
      .json({ error: "New password and confirm password don't match" });
  }

  // Fetch hashed password from the database
  connection.query(
    "SELECT password FROM users WHERE id = ?",
    [id],
    (error, results, fields) => {
      if (error) {
        return res.status(500).json({ error: "Internal server error" });
      }

      if (results.length === 0) {
        return res.status(404).json({ error: "User not found" });
      }

      const hashedPassword = results[0].password;

      // Compare hashed current password with the stored hashed password
      bcrypt.compare(currentPassword, hashedPassword, (err, isMatch) => {
        if (err) {
          return res.status(500).json({ error: "Internal server error" });
        }

        if (!isMatch) {
          return res
            .status(401)
            .json({ error: "Current password is incorrect" });
        }

        // Hash the new password
        bcrypt.hash(newPassword, 10, (err, hashedNewPassword) => {
          if (err) {
            return res.status(500).json({ error: "Internal server error" });
          }

          // Update hashed password in the database
          connection.query(
            "UPDATE users SET password = ? WHERE id = ?",
            [hashedNewPassword, id],
            (error, results, fields) => {
              if (error) {
                return res.status(500).json({ error: "Internal server error" });
              }

              return res
                .status(200)
                .json({ message: "Password updated successfully" });
            }
          );
        });
      });
    }
  );
});

app.get("/active-po", (req, res) => {
  connection.query(
    "SELECT COUNT(status) AS Active FROM po_list WHERE status = 3;",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database ");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ items: results });
    }
  );
});

app.get("/pending-po", (req, res) => {
  connection.query(
    "SELECT COUNT(status) AS Pending FROM po_list WHERE status = 1;",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database ");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ items: results });
    }
  );
});

app.get("/users", (req, res) => {
  connection.query("SELECT COUNT(id) AS user FROM users;", (error, results) => {
    if (error) {
      console.error("Error fetching items from database ");
      return res.status(500).json({ error: "Internal server error" });
    }
    res.json({ results });
  });
});

app.get("/pending-request", (req, res) => {
  connection.query(
    "SELECT count(id) AS Pending FROM requestmaterial WHERE approve_status = 0;",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database ");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ items: results });
    }
  );
});

app.post("/download-report", (req, res) => {
  const { project_name, stockType, from, to, site, item_name } = req.body;

  let query = "SELECT * FROM stocks_test1 WHERE 1=1";
  const queryParams = [];

  if (project_name) {
    query += " AND projectName = ?";
    queryParams.push(projectName);
  }
  if (stockType) {
    query += " AND stockType = ?";
    queryParams.push(stockType);
  }
  if (from) {
    query += " AND date >= ?";
    queryParams.push(from);
  }
  if (to) {
    query += " AND date <= ?";
    queryParams.push(to);
  }
  if (site) {
    query += " AND site = ?";
    queryParams.push(site);
  }
  if (item_name) {
    query += " AND material = ?";
    queryParams.push(material);
  }

  connection.query(query, queryParams, (error, results) => {
    if (error) {
      console.error("Error fetching report from database:", error.stack);
      return res.status(500).json({ error: "Internal server error" });
    }

    // Create a PDF document
    const doc = new PDFDocument();
    const filePath = `/tmp/report_${Date.now()}.pdf`;
    const writeStream = fs.createWriteStream(filePath);
    doc.pipe(writeStream);

    doc.fontSize(18).text("Report", { align: "center" });
    doc.moveDown();

    results.forEach((row, index) => {
      doc.fontSize(12).text(`Record ${index + 1}`, { underline: true });
      doc.fontSize(10).text(`Project Name: ${row.projectName}`);
      doc.text(`Stock Type: ${row.stockType}`);
      doc.text(`Date: ${row.date}`);
      doc.text(`Site: ${row.site}`);
      doc.text(`Material: ${row.material}`);
      doc.moveDown();
    });

    doc.end();

    writeStream.on("finish", () => {
      res.download(filePath, "report.pdf", (err) => {
        if (err) {
          console.error("Error downloading file:", err.stack);
          res.status(500).json({ error: "Error downloading file" });
        }

        // Clean up the file after download
        fs.unlink(filePath, (err) => {
          if (err) {
            console.error("Error deleting file:", err.stack);
          }
        });
      });
    });
  });
});

app.post("/accept-request", (req, res) => {
  const { id, remark } = req.body;

  const approved_date = new Date();
  console.log(approved_date);

  // Update status of query in database
  const sql = `UPDATE requestmaterial SET approve_status = 1, remark = ?, approved_date = ? WHERE id = ?`;

  connection.query(sql, [remark, approved_date, id], (err, result) => {
    if (err) {
      console.error("Error updating query status: ", err);
      return res.status(500).json({ message: "Error updating query status" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Query not found" });
    }

    console.log("Query status updated successfully");
    res.status(200).json({ message: "Query status updated successfully" });
  });
});

app.post("/delete-request", verifyToken, (req, res) => {
  const { id, remark } = req.body;

  const approved_date = new Date();
  console.log(approved_date);

  // Update status of query in database
  const sql = `UPDATE requestmaterial SET approve_status = 2, remark = ?, approved_date = ? WHERE id = ?`;

  connection.query(sql, [remark, approved_date, id], (err, result) => {
    if (err) {
      console.error("Error updating query status: ", err);
      return res.status(500).json({ message: "Error updating query status" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Query not found" });
    }

    console.log("Query status updated successfully");
    res.status(200).json({ message: "Query status updated successfully" });
  });
});

app.get("/user-list", (req, res) => {
  connection.query(
    "SELECT id, first_name, email, contact_no FROM users ;",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database ");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ user: results });
    }
  );
});

// Multer setup for file upload
const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 },
});

// API endpoint to upload XLSX file
app.post("/upload", upload.single("file"), (req, res) => {
  const file = req.file;
  if (!file) {
    return res.status(400).send("No file uploaded.");
  }

  // Parse the XLSX file
  const workbook = xlsx.readFile(file.path);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = xlsx.utils.sheet_to_json(sheet);

  // Insert rows into the MySQL database
  rows.forEach((row) => {
    const sql = `INSERT INTO stocks_test1 (
            item_id, item_name, make, mac_id, stock_holder_name, stock_holder_contact, stock_status, working_status, 
            rack, slot, added_date, supplier_id, item_status, project_name, cost, reciever_name, 
            reciever_contact, Location, updated_date, chalan_id, description, m_o_d, requested_date, deleted_date, requested_by, deleted_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [
      row.item_id,
      row.item_name,
      row.make,
      row.mac_id,
      row.stock_holder_name,
      row.stock_holder_contact,
      row.stock_status,
      row.working_status,
      row.rack,
      row.slot,
      row.added_date,
      row.supplier_id,
      row.item_status,
      row.project_name,
      row.cost,
      row.reciever_name,
      row.reciever_contact,
      row.Location,
      row.updated_date,
      row.chalan_id,
      row.description,
      row.m_o_d,
      row.requested_date,
      row.deleted_date,
      row.requested_by,
      row.deleted_by,
    ];

    connection.query(sql, values, (err) => {
      if (err) throw err;
    });
  });

  res.send("File uploaded and data inserted successfully.");
});

app.get("/item-id-dropdown", (req, res) => {
  connection.query(
    "SELECT distinct item_id FROM stocks_test1",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database ");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ users: results });
    }
  );
});

app.get("/notifications", (req, res) => {
  connection.query(
    "SELECT item_name, count(item_name) AS quantity FROM stocks_test1 GROUP BY item_name HAVING COUNT(item_name) < 20 order by item_name",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database ");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ users: results });
    }
  );
});

app.get("/supp-count", (req, res) => {
  connection.query(
    "SELECT count(id) AS suppcount FROM suppliers;",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database ");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ items: results });
    }
  );
});

app.get("/itemid-dropdown", (req, res) => {
  const { selectedValue } = req.query;

  if (!selectedValue) {
    return res.status(400).json({ message: "selectedValue is required" });
  }

  const query =
    "SELECT item_id FROM stocks_test1 WHERE item_status = 0 AND item_name = ? ";
  connection.query(query, [selectedValue], (err, results) => {
    if (err) {
      console.error("Error executing query:", err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
    res.status(200).json({ results });
  });
});

app.get("/po-history", verifyToken, (req, res) => {
  connection.query(
    "SELECT * FROM po_list WHERE status = '1' OR status = '2' ORDER BY updated_at DESC",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database ");
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ history: results });
    }
  );
});

app.get("/download-history", (req, res) => {
  const query =
    "SELECT * FROM stocks_test1 WHERE updated_date IS NOT NULL ORDER BY updated_date DESC";

  connection.query(query, async (err, results) => {
    if (err) {
      console.error("Error executing query:", err);
      res.status(500).send("Error executing query");
      return;
    }

    // Create a new Excel workbook and worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("History Data");

    // Define columns
    worksheet.columns = [
      { header: "Item ID", key: "item_id", width: 10 },
      { header: "Item Name", key: "item_name", width: 30 },
      { header: "Supplier ID", key: "supplier_id", width: 15 },
      { header: "Project Name", key: "project_name", width: 30 },
      { header: "Cost", key: "cost", width: 10 },
      { header: "Receiver Name", key: "reciever_name", width: 30 },
      { header: "Receiver Contact", key: "reciever_contact", width: 20 },
      { header: "Location", key: "Location", width: 20 },
      { header: "Chalan ID", key: "chalan_id", width: 15 },
      { header: "Description", key: "description", width: 40 },
      { header: "M_o_D", key: "m_o_d", width: 15 },
      { header: "Updated Date", key: "updated_date", width: 20 },
      { header: "ID", key: "id", width: 10 },
    ];

    // Add rows to the worksheet
    results.forEach((row) => {
      worksheet.addRow(row);
    });

    // Set the response headers to indicate a file attachment with a .xlsx extension
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=history.xlsx");

    // Write the workbook to the response
    await workbook.xlsx.write(res);

    // End the response
    res.end();
  });
});

app.set("view engine", "ejs");

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, "public")));

app.post("/send-item", (req, res) => {
  const {
    quantity,
    item_id,
    item_name,
    project_name,
    cost,
    reciever_name,
    reciever_contact,
    Location,
    chalan_id,
    description,
    m_o_d,
  } = req.body;

  // Array to hold multiple rows
  const rows = [];

  for (let i = 0; i < quantity; i++) {
    items.forEach((item) => {
      const row = [
        item_id,
        item_name,
        project_name,
        cost,
        reciever_name,
        reciever_contact,
        Location,
        chalan_id,
        description,
        m_o_d,
        // 1 // item_status set to 1
      ];
      rows.push(row);
    });
  }

  // SQL query to insert multiple rows
  const query = `UPDATE stocks_test1 SET item_status = ?, item_name=?, project_name=?, cost=?, reciever_name=?, reciever_contact=?, Location=?, chalan_id=?, description=?, m_o_d=? WHERE item_id=?`;

  db.query(sql, [rows], (err, result) => {
    if (err) {
      return res.status(500).send(err);
    }
    res.send("Items inserted successfully with item_status set to 1");
  });
});

app.get("/gen-barcode", (req, res) => {
  const { item_id } = req.query;

  if (!item_id) {
    return res.status(400).send("item_id query parameter is required");
  }

  try {
    // Generate the barcode
    bwipjs.toBuffer(
      {
        bcid: "code128", // Barcode type
        text: item_id, // Text to encode in the barcode
        scale: 3, // 3x scaling factor
        height: 10, // Bar height, in millimeters
        includetext: true, // Show the text below the barcode
        textxalign: "center", // Center-align the text
      },
      (err, png) => {
        if (err) {
          res.status(500).send("Error generating barcode");
        } else {
          // Set response headers for downloading the barcode
          res.setHeader("Content-Type", "image/png");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=barcode-${item_id}.png`
          );
          res.send(png);
        }
      }
    );
  } catch (err) {
    res.status(500).send("Error processing request");
  }
});

//Item Delete Request Page

app.get("/deleted-item-list", (req, res) => {
  //const { item_name } = req.body;

  connection.query(
    "SELECT item_id, item_name, supplier_id, stock_holder_name, stock_holder_contact, stock_status, working_status, rack, slot, deleted_date, deleted_by FROM stocks_test1 WHERE item_status = 4 ORDER BY deleted_date desc",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database:", error.stack);
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ items: results });
    }
  );
});

//Item Delete Request Page => On click Accept = PM

app.post("/delete-item", (req, res) => {
  // const allowedRoles = ["Admin"];

  // if (!allowedRoles.includes(req.user_data.role)) {
  //     return res
  //         .status(403)
  //         .json({ error: "Permission denied. Insufficient role." });
  // }

  const { item_id, deleted_by } = req.body;

  // Update item_status and set deleted_date to current timestamp
  const sql = `UPDATE stocks_test1 SET item_status = 4, deleted_date = CURRENT_TIMESTAMP, deleted_by = ? WHERE item_id = ?`;

  connection.query(sql, [deleted_by, item_id], (err, result) => {
    if (err) {
      console.error("Error updating query status: ", err);
      return res.status(500).json({ message: "Error updating query status" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Item not found" });
    }

    console.log("Item status updated successfully");
    res.status(200).json({ message: "Item deleted successfully" });
  });
});

//Deleted Item list Page = IM

app.get("/deleted-item-request", (req, res) => {
  // 0 = Pending, 1 = Approved, 2 = Declined, 5 = Delete Request
  connection.query(
    "SELECT * FROM stocks_test1 WHERE item_status = 5 ORDER BY deleted_date DESC",
    (error, results) => {
      if (error) {
        console.error("Error fetching items from database", error.stack);
        return res.status(500).json({ error: "Internal server error" });
      }
      res.json({ items: results });
    }
  );
});

//Delete item by IM => Added item list

app.post("/delete-request-item-accept", (req, res) => {
  // const allowedRoles = ["Admin"];

  // if (!allowedRoles.includes(req.user_data.role)) {
  //     return res
  //         .status(403)
  //         .json({ error: "Permission denied. Insufficient role." });
  // }

  const { item_id, requested_by } = req.body;
  console.log(`itemid ${item_id}, requestedby ${requested_by}`);

  // Update status of query in database
  const sql = `UPDATE stocks_test1 SET item_status = 5, requested_date = CURRENT_TIMESTAMP, requested_by = ? WHERE item_id = ?`;

  connection.query(sql, [requested_by, item_id], (err, result) => {
    if (err) {
      console.error("Error updating query status: ", err);
      return res.status(500).json({ message: "Error updating query status" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Query not found" });
    }

    console.log("Query status updated successfully");
    res.status(200).json({ message: "Query status updated successfully" });
  });
});

app.post("/delete-request-item-decline", (req, res) => {
  // const allowedRoles = ["Admin"];

  // if (!allowedRoles.includes(req.user_data.role)) {
  //     return res
  //         .status(403)
  //         .json({ error: "Permission denied. Insufficient role." });
  // }

  const { item_id } = req.body;

  // Update status of query in database
  const sql = `UPDATE stocks_test1 SET item_status = 0 WHERE item_id = ?`;

  connection.query(sql, [item_id], (err, result) => {
    if (err) {
      console.error("Error updating query status: ", err);
      return res.status(500).json({ message: "Error updating query status" });
    }

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "Query not found" });
    }

    console.log("Query status updated successfully");
    res.status(200).json({ message: "Query status updated successfully" });
  });
});

app.get("/gen-qr", (req, res) => {
  const { item_id } = req.query;

  if (!item_id) {
    return res.status(400).send("item_id query parameter is required");
  }

  try {
    // Generate the QR code
    qr.toBuffer(
      item_id,
      {
        errorCorrectionLevel: "H", // High error correction level
        type: "png", // Output type
        scale: 10, // Scale the QR code size
      },
      (err, buffer) => {
        if (err) {
          res.status(500).send("Error generating QR code");
        } else {
          // Set response headers for downloading the QR code
          res.setHeader("Content-Type", "image/png");
          res.setHeader(
            "Content-Disposition",
            `attachment; filename=qr-${item_id}.png`
          );
          res.send(buffer);
        }
      }
    );
  } catch (err) {
    res.status(500).send("Error processing request");
  }
});

app.post("/request-mat-ooo", verifyToken, (req, res) => {
  const { name, site_name, material, project_name, description, quantity } =
    req.body;

  // Assuming 'material' and 'quantity' are arrays
  if (
    !Array.isArray(material) ||
    !Array.isArray(quantity) ||
    material.length !== quantity.length
  ) {
    return res
      .status(400)
      .json({
        error: "Material and quantity should be arrays of the same length",
      });
  }

  const requests = material.map((mat, index) => ({
    name,
    site_name,
    material: mat,
    project_name,
    description,
    quantity: quantity[index],
  }));

  // Prepare query
  const query =
    "INSERT INTO requestmaterial (name, site_name, material, project_name, description, quantity) VALUES ?";

  // Data format for bulk insert
  const values = requests.map((req) => [
    req.name,
    req.site_name,
    req.material,
    req.project_name,
    req.description,
    req.quantity,
  ]);

  connection.query(query, [values], (error, results) => {
    if (error) {
      console.error("Error inserting items into the database: " + error.stack);
      return res.status(500).json({ error: "Internal server error" });
    }
    console.log(
      "Items added to database. Rows affected: " + results.affectedRows
    );

    // Send email (assuming you want to send an email for each request)
    requests.forEach((request) => {
      sendEmail("theo48173@gmail.com", request);
    });

    res
      .status(201)
      .json({ message: "Requests added successfully", items: requests });
  });
});

const port = process.env.PORT || 5050;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
