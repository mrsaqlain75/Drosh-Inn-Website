const express = require('express');
const bp = require('body-parser');
const { MongoClient, ObjectId } = require('mongodb');
const multer = require('multer');
const fs = require('fs');
const path = require('path');

const app = express();
const port = 2500;
const url = "mongodb://localhost:27017/";

// Ensure uploads directory exists
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Middleware
app.use(express.json());
app.use(bp.json());
app.use(bp.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // Directory where files will be saved
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`); // Unique file names
  },
});
const upload = multer({ storage: storage });

// Add Room Route
app.post('/add-room', upload.array('images', 3), async (req, res) => {
  const client = new MongoClient(url);
  try {
    console.log('Request Body:', req.body); // Check incoming data
    console.log('Uploaded Files:', req.files); // Check uploaded files

    const { roomName, roomType, price, description, availability } = req.body;
    if (!roomName || !roomType || !price || !description || !availability) {
      throw new Error('Missing required fields');
    }

    if (!req.files || req.files.length !== 3) {
      throw new Error('Exactly 3 images are required');
    }

    const images = req.files.map(file => `/uploads/${file.filename}`); // Make sure images are being mapped correctly

    await client.connect();
    const db = client.db('DroshInn');
    const collection = db.collection('Rooms');

    const newRoom = {
      roomName,
      roomType,
      price: parseFloat(price),
      description,
      availability,
      images, // Save images paths correctly
      createdAt: new Date(),
    };

    const result = await collection.insertOne(newRoom);
    res.status(201).json({
      message: 'Room added successfully!',
      roomId: result.insertedId,
    });
  } catch (e) {
    console.error('Error inserting room:', e.message);
    res.status(500).json({
      message: 'Failed to add room. Please try again later.',
      error: e.message,
    });
  } finally {
    await client.close();
  }
});

// Show Rooms Route
app.get('/show-rooms', async (req, res) => {
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db('DroshInn');
    const collection = db.collection('Rooms');
    const rooms = await collection.find().toArray();

    // Log the rooms data to check if it has the correct fields
    console.log('Rooms from DB:', rooms);
    res.status(200).json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ message: 'Error fetching rooms', error });
  }
});

// Update Room Status Route
app.put('/update-status/:id', async (req, res) => {
  const { id } = req.params; // Get room ID from params
  const { status } = req.body; // Get the new status from the request body

  if (!status) {
    return res.status(400).json({ message: 'Status is required' });
  }

  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db('DroshInn');
    const collection = db.collection('Rooms');
    
    const room = await collection.findOne({ _id: new ObjectId(id) });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Update the room status
    await collection.updateOne({ _id: new ObjectId(id) }, {
      $set: { availability: status },
    });

    res.status(200).json({ message: 'Room status updated successfully' });
  } catch (error) {
    console.error('Error updating room status:', error);
    res.status(500).json({ message: 'Error updating room status', error });
  } finally {
    await client.close();
  }
});

// Delete Room Route
app.delete('/delete-room/:id', async (req, res) => {
  const { id } = req.params; // Get room ID from params

  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db('DroshInn');
    const collection = db.collection('Rooms');
    
    const room = await collection.findOne({ _id: new ObjectId(id) });

    if (!room) {
      return res.status(404).json({ message: 'Room not found' });
    }

    // Delete the room
    await collection.deleteOne({ _id: new ObjectId(id) });

    res.status(200).json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ message: 'Error deleting room', error });
  } finally {
    await client.close();
  }
});

// Route to handle booking submissions
app.post('/submit-booking', async (req, res) => {
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db('DroshInn');

    const {
      name,
      email,
      phone,
      checkin,
      checkout,
      roomName,
      notes,
      totalPrice
    } = req.body;

    // Insert booking into the "Bookings" collection
    const bookingsCollection = db.collection('Bookings');
    await bookingsCollection.insertOne({
      name,
      email,
      phone,
      checkin: new Date(checkin),
      checkout: new Date(checkout),
      roomName,
      notes: notes || '',
      totalPrice: parseFloat(totalPrice),
      bookingDate: new Date(), // Track when the booking was made
    });
    // Respond with a JSON object
    res.status(200).json({
      message: 'Booking successfully saved.',
      bookingDetails: { name, email, phone, roomName, totalPrice } // Add any relevant details
    });
  } catch (error) {
    console.error('Error saving booking:', error);
    res.status(500).send('An error occurred while saving the booking.');
  } finally {
    await client.close();
  }
});

// Route to fetch all bookings
app.get('/all-bookings', async (req, res) => {
  const client = new MongoClient(url);
  try {
    await client.connect();
    const db = client.db('DroshInn');

    // Fetch all bookings from the "Bookings" collection
    const bookingsCollection = db.collection('Bookings');
    const bookings = await bookingsCollection.find().toArray(); // Fetch all documents

    // Send the bookings as JSON
    res.status(200).json(bookings);
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ message: 'An error occurred while fetching bookings.' });
  } finally {
    await client.close();
  }
});

// Route to delete a booking by ID
app.delete('/delete-booking/:id', async (req, res) => {
  try {
    const bookingId = req.params.id;
    const result = await db.collection('Bookings').deleteOne({ _id: ObjectId(bookingId) });

    if (result.deletedCount === 0) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    res.status(200).json({ message: 'Booking deleted successfully' });
  } catch (error) {
    console.error('Error deleting booking:', error);
    res.status(500).json({ message: 'Failed to delete booking' });
  }
});


// Start server
app.listen(port, () => {
  console.log(`Server running at http://127.0.0.1:${port}`);
});
