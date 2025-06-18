const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3000;

// ✅ Enable CORS
app.use(cors());

// Middlewares
app.use(express.json());

// Your routes go here
app.get('/', (req, res) => {
    res.send('Backend is working!');
});

// Example POST route (replace with real logic)
app.post('/api/resolveComplaint', (req, res) => {
    const complaintId = req.body.id;
    if (!complaintId) {
        return res.status(400).json({ error: "Complaint ID is required" });
    }
    // Simulate success
    res.json({ message: `Complaint ${complaintId} resolved.` });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});


// Database connection
const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
    res.send('Hostel Management System API');
});

// Student routes
app.post('/students', async (req, res) => {
  try {
      const { name, email, phone, course, year, password } = req.body;
      
      // Check if email already exists
      const emailCheck = await pool.query(
          'SELECT * FROM students WHERE email = $1',
          [email]
      );
      
      if (emailCheck.rows.length > 0) {
          return res.status(400).json({ message: "Email already exists" });
      }
      
      const result = await pool.query(
          'INSERT INTO students (name, email, phone, course, year, password) VALUES ($1, $2, $3, $4, $5, $6) RETURNING student_id, name, email',
          [name, email, phone, course, year, password] // Use hashedPassword in production
      );
      res.status(201).json(result.rows[0]);
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});

// Get student complaints
app.get('/students/:id/complaints', async (req, res) => {
  try {
      const { id } = req.params;
      const result = await pool.query(
          'SELECT * FROM complaints WHERE student_id = $1 ORDER BY date_submitted DESC',
          [id]
      );
      res.json(result.rows);
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});

// Get student room information
app.get('/students/:id/room', async (req, res) => {
  try {
      const { id } = req.params;
      // First check if the student has a room allocation
      const roomAllocation = await pool.query(
          'SELECT room_id FROM student_rooms WHERE student_id = $1 AND status = $2',
          [id, 'Active']
      );
      
      // If no room is allocated, return empty result
      if (roomAllocation.rows.length === 0) {
          return res.json({ room_number: null });
      }
      
      // Get room details
      const room_id = roomAllocation.rows[0].room_id;
      const roomDetails = await pool.query(
          'SELECT * FROM rooms WHERE room_id = $1',
          [room_id]
      );
      
      res.json(roomDetails.rows[0] || { room_number: null });
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Complaint routes
app.post('/complaints', async (req, res) => {
    try {
        const { student_id, complaint_text } = req.body;
        
        // Get student's room_id if available
        const roomResult = await pool.query(
            'SELECT room_id FROM student_rooms WHERE student_id = $1 AND status = $2',
            [student_id, 'Active']
        );
        const room_id = roomResult.rows.length > 0 ? roomResult.rows[0].room_id : null;
        
        const result = await pool.query(
            'INSERT INTO complaints (student_id, room_id, complaint_text) VALUES ($1, $2, $3) RETURNING *',
            [student_id, room_id, complaint_text]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: 'Server error', error: err.message });
    }
});

// Get all complaints (for admin)
app.get('/complaints', async (req, res) => {
  try {
      const result = await pool.query(`
          SELECT c.*, s.name as student_name, r.room_number 
          FROM complaints c
          JOIN students s ON c.student_id = s.student_id
          LEFT JOIN rooms r ON c.room_id = r.room_id
          ORDER BY c.date_submitted DESC
      `);
      res.json(result.rows);
  } catch (err) {
      res.status(500).send('Server error');
  }
});

// Resolve complaint
app.put('/complaints/:id/resolve', async (req, res) => {
  try {
      const { id } = req.params;
      await pool.query(
          'UPDATE complaints SET status = $1 WHERE complaint_id = $2',
          ['Resolved', id]
      );
      res.json({ message: 'Complaint resolved' });
  } catch (err) {
      res.status(500).send('Server error');
  }
});

// Get all rooms (for admin)
app.get('/rooms', async (req, res) => {
  try {
      const result = await pool.query('SELECT * FROM rooms ORDER BY room_number');
      res.json(result.rows);
  } catch (err) {
      res.status(500).send('Server error');
  }
});

// Get admin dashboard stats
app.get('/admin/stats', async (req, res) => {
  try {
      const [students, rooms, complaints] = await Promise.all([
          pool.query('SELECT COUNT(*) as count FROM students WHERE is_admin = false'),
          pool.query('SELECT COUNT(*) as count FROM rooms'),
          pool.query('SELECT COUNT(*) as count FROM complaints')
      ]);
      
      res.json({
          students: students.rows[0].count,
          rooms: rooms.rows[0].count,
          complaints: complaints.rows[0].count
      });
  } catch (err) {
      console.error(err);
      res.status(500).send('Server error');
  }
});

// login Route
app.post("/login", async (req, res) => {
  const { userName, password } = req.body;

  if (!userName || !password) {
    return res.status(400).json({ message: "Username and password are required" });
  }

  try {
    // Find user in database
    const result = await pool.query(
      'SELECT student_id, name, password, is_admin FROM students WHERE email = $1 OR phone = $1',
      [userName]
    );

    if (result.rows.length === 0) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    const user = result.rows[0];

    // Simple password comparison 
    if (user.password === password) {
      return res.status(200).json({ 
        message: "Login successful", 
        userId: user.student_id,
        userName: user.name,
        isAdmin: user.is_admin  
      });
    } else {
      return res.status(400).json({ message: "Password incorrect" });
    }

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: "Server error" });
  }
});

// Get all students (for admin)
app.get('/students', async (req, res) => {
  try {
      const result = await pool.query(`
          SELECT s.*, sr.room_id, r.room_number 
          FROM students s
          LEFT JOIN student_rooms sr ON s.student_id = sr.student_id AND sr.status = 'Active'
          LEFT JOIN rooms r ON sr.room_id = r.room_id
          WHERE s.is_admin = false
          ORDER BY s.name
      `);
      res.json(result.rows);
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Assign room to student
app.post('/room-assignments', async (req, res) => {
  try {
      const { student_id, room_id } = req.body;
      
      // Check if room exists and has capacity
      const roomCheck = await pool.query(
          'SELECT * FROM rooms WHERE room_id = $1',
          [room_id]
      );
      
      if (roomCheck.rows.length === 0) {
          return res.status(404).json({ message: 'Room not found' });
      }
      
      // Check current occupancy
      const occupancyCheck = await pool.query(
          'SELECT COUNT(*) as count FROM student_rooms WHERE room_id = $1 AND status = $2',
          [room_id, 'Active']
      );
      
      if (parseInt(occupancyCheck.rows[0].count) >= roomCheck.rows[0].capacity) {
          return res.status(400).json({ message: 'Room is at full capacity' });
      }
      
      // Deactivate any existing room assignments for this student
      await pool.query(
          'UPDATE student_rooms SET status = $1 WHERE student_id = $2 AND status = $3',
          ['Inactive', student_id, 'Active']
      );
      
      // Create new room assignment
      const result = await pool.query(
          'INSERT INTO student_rooms (student_id, room_id) VALUES ($1, $2) RETURNING *',
          [student_id, room_id]
      );
      
      // Update room status if it's now full
      const newOccupancy = await pool.query(
          'SELECT COUNT(*) as count FROM student_rooms WHERE room_id = $1 AND status = $2',
          [room_id, 'Active']
      );
      
      if (parseInt(newOccupancy.rows[0].count) >= roomCheck.rows[0].capacity) {
          await pool.query(
              'UPDATE rooms SET status = $1 WHERE room_id = $2',
              ['Occupied', room_id]
          );
      }
      
      res.status(201).json(result.rows[0]);
  } catch (err) {
      console.error(err);
      res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ================= EVENT ENDPOINTS =================
// Get all events
app.get('/events', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, s.name as created_by_name 
      FROM events e
      LEFT JOIN students s ON e.created_by = s.student_id
      ORDER BY e.event_date DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get upcoming events (for student dashboard)
app.get('/events/upcoming', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT e.*, s.name as created_by_name 
      FROM events e
      LEFT JOIN students s ON e.created_by = s.student_id
      WHERE e.event_date >= NOW()
      ORDER BY e.event_date ASC
      LIMIT 5
    `);
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get event by ID
app.get('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('SELECT * FROM events WHERE event_id = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Create event
app.post('/events', async (req, res) => {
  try {
    const { title, description, event_date, location, created_by } = req.body;
    
    const result = await pool.query(
      'INSERT INTO events (title, description, event_date, location, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [title, description, event_date, location, created_by]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Update event
app.put('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, event_date, location } = req.body;
    
    const result = await pool.query(
      'UPDATE events SET title = $1, description = $2, event_date = $3, location = $4, updated_at = NOW() WHERE event_id = $5 RETURNING *',
      [title, description, event_date, location, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Delete event
app.delete('/events/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM events WHERE event_id = $1 RETURNING event_id', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Event not found' });
    }
    
    res.json({ message: 'Event deleted successfully', event_id: result.rows[0].event_id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Start server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
