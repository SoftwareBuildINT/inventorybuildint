const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const nodemailer = require('nodemailer');
const randomstring = require('randomstring');
const PDFDocument = require('pdfkit');
const fs = require('fs');       //To read file
const dotenv = require('dotenv');
dotenv.config();
const app = express();

/// hellol

app.use(bodyParser.json());

//MySQL connection configuration
const connection = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
});

// Test
// const connection = mysql.createConnection({
//     host: "localhost",
//     user: "admin_buildINT",
//     password: "buildINT@2023$",
//     database: "inventory",
// });


//function to verify token
function verifyToken(req, res, next) {
    // Get token from headers, query parameters, or request body
    const token = req.headers['authorization'];

    if (!token) {
        return res.status(403).json({ error: 'Token is required' });
    }

    jwt.verify(token, "secretkey", (err, decoded) => {
        if (err) {
            return res.status(401).json({ error: 'Failed to authenticate token' });
        }
        req.decoded = decoded;
        next();
    });
}
app.get('/profile/:userId', (req, res) => {
    const userId = req.params.userId;

    connection.query('SELECT firstName FROM login WHERE userId = ?', [userId], (error, results) => {
        if (error) {
            console.error('Error fetching name from database:', error.stack);
            return res.status(500).json({ error: 'Internal server error' });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const firstName = results[0].firstName;
        res.json({ firstName });

    });
})

// app.get('/generate-pdf', async (req, res) => {
//     // Create a new PDF document
//     const doc = new PDFDocument();

//     // Pipe the PDF content to a writable stream
//     const stream = fs.createWriteStream('generated-pdf.pdf');
//     doc.pipe(stream);

//     // Add content to the PDF 
//     data.project_engg.forEach(row => {

//     doc.rect(50, 50, 514, 700).stroke();
//     // doc.image('./C:/Users/broto/Downloads/BuildINT.png', 207, 55, { width: 200, height: 50 });
//     doc.font('Times-Bold').fontSize(14).text('DELIVERY CHALLAN', 55, 115, { width: 504, height: 35, align: 'left' })
//     doc.font('Times-Bold').fontSize(14).text('Lightforce Buildint Pvt Ltd', 55, 130, { width: 504, height: 35, align: 'left' })
//     doc.font('Times-Bold').fontSize(10).text('408-412, Srishti Palza, Off Saki Vihar Road,', 55, 145, { width: 504, height: 35, align: 'left' })
//     doc.font('Times-Bold').fontSize(10).text('Powai, Mumbai 400072', 55, 160, { width: 504, height: 35, align: 'left' })
//     doc.rect(50, 180, 514, 40).stroke();
//     doc.font('Times-Bold').fontSize(25).text('Delivery Challan ', 165, 195, { width: 280, height: 5, align: 'center' })
//     doc.rect(50, 220, 257, 25).stroke();
//     doc.font('Times-Bold').fontSize(15).text(`Challan Id :  ${row.challan_id}`, 55, 230, { width: 280, height: 5, align: 'left' })
//     doc.rect(306, 220, 257, 25).stroke();
//     doc.font('Times-Bold').fontSize(15).text('Challan Date:  ', 310, 230, { width: 280, height: 5, align: 'left' })
//     doc.rect(50, 245, 257, 25).stroke();
//     doc.font('Times-Bold').fontSize(15).text('Contact Person :  ', 55, 252, { width: 280, height: 5, align: 'left' })
//     doc.rect(306, 245, 257, 25).stroke();
//     doc.font('Times-Bold').fontSize(15).text('Contact Number :  ', 310, 252, { width: 280, height: 5, align: 'left' })
//     doc.rect(50, 270, 257, 25).stroke();
//     doc.font('Times-Bold').fontSize(15).text('ATM ID :  ', 55, 275, { width: 280, height: 5, align: 'left' })
//     doc.rect(306, 270, 257, 25).stroke();
//     doc.font('Times-Bold').fontSize(15).text('HPY Code :  ', 310, 275, { width: 280, height: 5, align: 'left' })
//     doc.rect(50, 295, 257, 25).stroke();
//     doc.font('Times-Bold').fontSize(15).text('Reverse Charge :  ', 55, 300, { width: 280, height: 5, align: 'left' })
//     doc.rect(306, 295, 257, 25).stroke();
//     doc.font('Times-Bold').fontSize(15).text('Reverse Charge  :  ', 310, 300, { width: 280, height: 5, align: 'left' })
//     doc.rect(50, 320, 257, 65).stroke();
//     doc.font('Times-Bold').fontSize(15).text('Billed To :  ', 55, 325, { width: 280, height: 5, align: 'left' })
//     doc.font('Times-Bold').fontSize(12).text('Name :  ', 55, 345, { width: 280, height: 5, align: 'left' })
//     doc.rect(306, 320, 257, 65).stroke();
//     doc.font('Times-Bold').fontSize(15).text('Shipped To :  ', 310, 325, { width: 280, height: 5, align: 'left' })
//     doc.font('Times-Bold').fontSize(12).text('Name :  ', 310, 345, { width: 280, height: 5, align: 'left' })
//     doc.rect(50, 385, 50, 25).stroke();
//     doc.font('Times-Bold').fontSize(10).text('SR. NO:  ', 52, 395, { width: 280, height: 5, align: 'left' })
//     doc.rect(100, 385, 207, 25).stroke();
//     doc.font('Times-Bold').fontSize(10).text('Description of Goods:  ', 150, 395, { width: 280, height: 5, align: 'left' })
//     doc.rect(306, 385, 50, 25).stroke();
//     doc.font('Times-Bold').fontSize(10).text('Qty  ', 315, 395, { width: 280, height: 5, align: 'left' })
//     doc.rect(356, 385, 207, 25).stroke();
//     doc.font('Times-Bold').fontSize(10).text('Approx Amount  ', 420, 395, { width: 280, height: 5, align: 'left' })
//     doc.rect(50, 410, 50, 150).stroke();
//     doc.rect(100, 410, 207, 150).stroke();
//     doc.rect(306, 410, 207, 150).stroke();
//     doc.rect(356, 410, 207, 150).stroke();
//     doc.rect(50, 560, 50, 20).stroke();
//     doc.rect(100, 560, 207, 20).stroke();
//     doc.font('Times-Bold').fontSize(10).text('Total:', 140, 565, { width: 280, height: 5, align: 'center' })
//     doc.rect(306, 560, 207, 20).stroke();
//     doc.rect(356, 560, 207, 20).stroke();
//     doc.rect(50, 580, 514, 30).stroke();
//     doc.font('Times-Bold').fontSize(10).text('If any difference is found in quantity, quality and rate etc. it should be notified in writing withing 24 Hours. No claim will be entertained thereafter', 52, 585)
//     doc.font('Times-Bold').fontSize(10).text('For LIGHTFORCE BUILDINT PRIVATE LIMITED', 52, 615)
//     doc.font('Times-Bold').fontSize(10).text('Authorized Signatory', 52, 690)
//     doc.font('Times-Bold').fontSize(10).text('Received By : ____', 250, 690, { width: 280, height: 5, align: 'right' })

//     // Finalize the PDF and close the stream
//     doc.end();
//     stream.on('finish', () => {
//         res.download('generated-pdf.pdf', 'generated-pdf.pdf', (err) => {
//             if (err) {
//                 console.error('Error downloading PDF:', err);
//                 res.status(500).send('Error downloading PDF');
//             } else {
//                 console.log('PDF generated and downloaded successfully');
//                 fs.unlinkSync('generated-pdf.pdf'); // Delete the temporary PDF file
//             }
//         });
//     });



//     try {
//         // Replace 123 with the specific ATM ID you want to query
//         const { sendmaterial } = req.query;

//         const query3 = 'SELECT * FROM sendmaterial WHERE challan_id = ?';


//         const values = [sendmaterial];
//         const results = {};

//         async function executeQuery(query, value, key) {
//             return new Promise((resolve, reject) => {
//                 connection.query(query, value, (err, result) => {
//                     if (err) {
//                         reject(err);
//                     } else {
//                         results[key] = result;
//                         resolve();
//                     }
//                 });
//             });
//         }

//         const queries = [query3];
//         const keys = ['sendmaterial'];

//         const promises = [];

//         for (let i = 0; i < queries.length; i++) {
//             promises.push(executeQuery(queries[i], values[i], keys[i]));
//         }

//         await Promise.all(promises);
//         const data = results;
//         if (data.length === 0) {
//             return res.status(404).json({ message: 'No data found' });
//         }

//         const pdfData = await generatePDFprojectengg(data);
//         // Send the generated PDF as a response
//         res.setHeader('Content-Disposition', 'attachment; filename="output.pdf"');
//         res.setHeader('Content-Type', 'application/pdf');
//         res.status(200).end(pdfData);
//     } catch (error) {
//         console.error('Error:', error);
//         res.status(500).json({ error: 'Internal Server Error' });
//     }

// });


function generatePDF(data) {
    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({ size: [595.28, 955.89] });
        const buffers = [];
        doc.on('data', (buffer) => buffers.push(buffer));
        doc.on('end', () => {
            const pdfData = Buffer.concat(buffers);
            resolve(pdfData);
        });
        data.forEach(row => {

            doc.rect(50, 50, 514, 700).stroke();
            // doc.image('./C:/Users/broto/Downloads/BuildINT.png', 207, 55, { width: 200, height: 50 });
            doc.font('Times-Bold').fontSize(14).text('DELIVERY CHALLAN', 55, 115, { width: 504, height: 35, align: 'left' })
            doc.font('Times-Bold').fontSize(14).text('Lightforce Buildint Pvt Ltd', 55, 130, { width: 504, height: 35, align: 'left' })
            doc.font('Times-Bold').fontSize(10).text('408-412, Srishti Palza, Off Saki Vihar Road,', 55, 145, { width: 504, height: 35, align: 'left' })
            doc.font('Times-Bold').fontSize(10).text('Powai, Mumbai 400072', 55, 160, { width: 504, height: 35, align: 'left' })
            doc.rect(50, 180, 514, 40).stroke();
            doc.font('Times-Bold').fontSize(25).text('Delivery Challan ', 165, 195, { width: 280, height: 5, align: 'center' })
            doc.rect(50, 220, 257, 25).stroke();
            doc.font('Times-Bold').fontSize(15).text(`Challan Id :  ${row.challan_id}`, 55, 230, { width: 280, height: 5, align: 'left' })
            doc.rect(306, 220, 257, 25).stroke();
            doc.font('Times-Bold').fontSize(15).text('Challan Date:  ', 310, 230, { width: 280, height: 5, align: 'left' })
            doc.rect(50, 245, 257, 25).stroke();
            doc.font('Times-Bold').fontSize(15).text(`Contact Person :  ${row.receiver_name}`, 55, 252, { width: 280, height: 5, align: 'left' })
            doc.rect(306, 245, 257, 25).stroke();
            doc.font('Times-Bold').fontSize(15).text(`Contact Number :  ${row.receiver_contact}`, 310, 252, { width: 280, height: 5, align: 'left' })
            doc.rect(50, 270, 257, 25).stroke();
            doc.font('Times-Bold').fontSize(15).text(`ATM ID :   ${row.site_id}`, 55, 275, { width: 280, height: 5, align: 'left' })
            doc.rect(306, 270, 257, 25).stroke();
            doc.font('Times-Bold').fontSize(15).text('HPY Code :  ', 310, 275, { width: 280, height: 5, align: 'left' })
            doc.rect(50, 295, 257, 25).stroke();
            doc.font('Times-Bold').fontSize(15).text('Reverse Charge :  ', 55, 300, { width: 280, height: 5, align: 'left' })
            doc.rect(306, 295, 257, 25).stroke();
            doc.font('Times-Bold').fontSize(15).text('Reverse Charge  :  ', 310, 300, { width: 280, height: 5, align: 'left' })
            doc.rect(50, 320, 257, 65).stroke();
            doc.font('Times-Bold').fontSize(15).text(`Billed To :  ${row.receiver_name}`, 55, 325, { width: 280, height: 5, align: 'left' })
            doc.font('Times-Bold').fontSize(12).text('Name :  ', 55, 345, { width: 280, height: 5, align: 'left' })
            doc.rect(306, 320, 257, 65).stroke();
            doc.font('Times-Bold').fontSize(15).text(`Shipped To :  ${row.location}`, 310, 325, { width: 280, height: 5, align: 'left' })
            doc.font('Times-Bold').fontSize(12).text('Name :  ', 310, 345, { width: 280, height: 5, align: 'left' })
            doc.rect(50, 385, 50, 25).stroke();
            doc.font('Times-Bold').fontSize(10).text('SR. NO:  ', 52, 395, { width: 280, height: 5, align: 'left' })
            doc.rect(100, 385, 207, 25).stroke();
            doc.font('Times-Bold').fontSize(10).text(`Description of Goods:  ${row.material}`, 150, 395, { width: 280, height: 5, align: 'left' })
            doc.rect(306, 385, 50, 25).stroke();
            doc.font('Times-Bold').fontSize(10).text(`Qty  ${row.quantity}`, 315, 395, { width: 280, height: 5, align: 'left' })
            doc.rect(356, 385, 207, 25).stroke();
            doc.font('Times-Bold').fontSize(10).text('Approx Amount  ', 420, 395, { width: 280, height: 5, align: 'left' })
            doc.rect(50, 410, 50, 150).stroke();
            doc.rect(100, 410, 207, 150).stroke();
            doc.rect(306, 410, 207, 150).stroke();
            doc.rect(356, 410, 207, 150).stroke();
            doc.rect(50, 560, 50, 20).stroke();
            doc.rect(100, 560, 207, 20).stroke();
            doc.font('Times-Bold').fontSize(10).text('Total:', 140, 565, { width: 280, height: 5, align: 'center' })
            doc.rect(306, 560, 207, 20).stroke();
            doc.rect(356, 560, 207, 20).stroke();
            doc.rect(50, 580, 514, 30).stroke();
            doc.font('Times-Bold').fontSize(10).text('If any difference is found in quantity, quality and rate etc. it should be notified in writing withing 24 Hours. No claim will be entertained thereafter', 52, 585)
            doc.font('Times-Bold').fontSize(10).text('For LIGHTFORCE BUILDINT PRIVATE LIMITED', 52, 615)
            doc.font('Times-Bold').fontSize(10).text('Authorized Signatory', 52, 690)
            doc.font('Times-Bold').fontSize(10).text('Received By : ____', 250, 690, { width: 280, height: 5, align: 'right' })

        });
        // Finalize the PDF and close the stream
        doc.end();

    });
} app.get('/generatepdf', async (req, res) => {
    try {
        const { sendmaterial } = req.query;
        const query = 'SELECT * FROM sendmaterial WHERE challan_id = ?';
        const values = [sendmaterial];
        const results = {};

        async function executeQuery(query, value, key) {
            return new Promise((resolve, reject) => {
                connection.query(query, value, (err, result) => {
                    if (err) {
                        reject(err);
                    } else {
                        results[key] = result;
                        resolve();
                    }
                });
            });
        }

        const promises = [executeQuery(query, values, 'sendmaterial')];
        await Promise.all(promises);

        const data = results.sendmaterial;
        if (data.length === 0) {
            return res.status(404).json({ message: 'No data found' });
        }

        const pdfData = await generatePDF(data);
        res.setHeader('Content-Disposition', 'attachment; filename="output.pdf"');
        res.setHeader('Content-Type', 'application/pdf');
        res.status(200).end(pdfData);
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// Start the server
const port = process.env.PORT || 5055;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
});