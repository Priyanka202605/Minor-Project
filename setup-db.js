const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
});

async function setupDatabase() {
  try {
    // Create database
    await pool.query('CREATE DATABASE hostel_db');
    console.log('Database created');

    // Connect to new database
    const dbPool = new Pool({
      user: process.env.DB_USER,
      host: process.env.DB_HOST,
      database: 'hostel_db',
      password: process.env.DB_PASSWORD,
      port: process.env.DB_PORT,
    });

    // Create tables
    await dbPool.query(`
      CREATE TABLE students (
        student_id SERIAL PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        email VARCHAR(100) UNIQUE NOT NULL,
        phone VARCHAR(20),
        course VARCHAR(50),
        year INTEGER,
        password VARCHAR(100) NOT NULL,
        is_admin BOOLEAN DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await dbPool.query(`
      CREATE TABLE rooms (
        room_id SERIAL PRIMARY KEY,
        room_number VARCHAR(20) UNIQUE NOT NULL,
        capacity INTEGER NOT NULL,
        status VARCHAR(20) DEFAULT 'Available' CHECK (status IN ('Available', 'Occupied', 'Under Maintenance')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create student_rooms relationship table
    await dbPool.query(`
      CREATE TABLE student_rooms (
        id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(student_id),
        room_id INTEGER REFERENCES rooms(room_id),
        allocation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
        UNIQUE(student_id, room_id)
      )
    `);

    await dbPool.query(`
      CREATE TABLE complaints (
        complaint_id SERIAL PRIMARY KEY,
        student_id INTEGER REFERENCES students(student_id),
        room_id INTEGER REFERENCES rooms(room_id),
        complaint_text TEXT NOT NULL,
        date_submitted TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        status VARCHAR(20) DEFAULT 'Pending' CHECK (status IN ('Pending', 'Resolved')),
        resolution_notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create events table
    await dbPool.query(`
      CREATE TABLE events (
        event_id SERIAL PRIMARY KEY,
        title VARCHAR(100) NOT NULL,
        description TEXT,
        event_date TIMESTAMP NOT NULL,
        location VARCHAR(100),
        created_by INTEGER REFERENCES students(student_id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create admin user
    await dbPool.query(`
      INSERT INTO students (name, email, phone, password, is_admin)
      VALUES ('Admin User', 'admin@gndec.ac.in', '1234567890', '123', TRUE)
    `);

    // Create some sample rooms
    await dbPool.query(`
      INSERT INTO rooms (room_number, capacity) VALUES 
      ('70', 2),
      ('71', 2),
      ('72', 3),
      ('73', 3),
      ('74', 1)
    `);

    console.log('Tables and sample data created successfully');
  } catch (err) {
    console.error('Error setting up database:', err);
  } finally {
    await pool.end();
  }
}

setupDatabase();