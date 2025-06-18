// Student dashboard specific code
document.addEventListener('DOMContentLoaded', () => {
    const userData = JSON.parse(sessionStorage.getItem('hostelUser') || 'null');
    
    if (userData && !userData.isAdmin) {
        // Set up student name display
        if (document.getElementById('studentName')) {
            document.getElementById('studentName').textContent = userData.userName || '';
        }
        
        // Load student data
        loadStudentData(userData.userId);
        
        // Set up complaint form
        const complaintForm = document.getElementById('complaintForm');
        if (complaintForm) {
            complaintForm.addEventListener('submit', handleComplaintSubmit);
        }
    }
});

// Student data loader
async function loadStudentData(userId) {
    try {
        // Add loading indicators
        addLoadingState('roomInfo');
        addLoadingState('complaintsList');
        addLoadingState('upcomingEvents');
        
        // Fetch data in parallel
        const [complaints, room, events] = await Promise.all([
            apiCall(`/students/${userId}/complaints`),
            apiCall(`/students/${userId}/room`),
            apiCall('/events/upcoming')
        ]);
        
        // Render the data
        renderStudentDashboard(complaints, room);
        renderUpcomingEvents(events);
    } catch (error) {
        console.error('Student data loading error:', error);
        showErrorMessage('Failed to load data. Please refresh the page.');
    }
}

// Render student dashboard
function renderStudentDashboard(complaints, room) {
    // Render room info
    const roomInfo = document.getElementById('roomInfo');
    if (roomInfo) {
        roomInfo.innerHTML = room.room_number 
            ? `<div class="text-center">
                <h3>Room ${room.room_number}</h3>
                <p>Status: ${room.status || 'Active'}</p>
                <p>Capacity: ${room.capacity || 'N/A'}</p>
               </div>`
            : '<div class="alert alert-info">No room allocated yet</div>';
    }
    
    // Render complaints list
    const complaintsList = document.getElementById('complaintsList');
    if (complaintsList) {
        complaintsList.innerHTML = complaints.length 
            ? complaints.map(c => `
                <div class="list-group-item">
                    <div class="d-flex w-100 justify-content-between">
                        <h6 class="mb-1">${new Date(c.date_submitted).toLocaleDateString()}</h6>
                        <small class="badge ${c.status === 'Resolved' ? 'bg-success' : 'bg-warning'}">${c.status}</small>
                    </div>
                    <p class="mb-1">${c.complaint_text}</p>
                </div>
            `).join('')
            : '<p class="text-center">No complaints submitted</p>';
    }
}

// Render upcoming events
function renderUpcomingEvents(events) {
    const eventsContainer = document.getElementById('upcomingEvents');
    if (eventsContainer) {
        if (events.length === 0) {
            eventsContainer.innerHTML = '<p class="text-center mt-3">No upcoming events scheduled.</p>';
            return;
        }
        
        eventsContainer.innerHTML = events.map(event => {
            const eventDate = new Date(event.event_date);
            const today = new Date();
            const tomorrow = new Date();
            tomorrow.setDate(today.getDate() + 1);
            
            // Check if event is today or tomorrow for highlight
            let badgeClass = 'bg-primary';
            let dayText = eventDate.toLocaleDateString();
            
            if (eventDate.toDateString() === today.toDateString()) {
                badgeClass = 'bg-danger';
                dayText = 'Today';
            } else if (eventDate.toDateString() === tomorrow.toDateString()) {
                badgeClass = 'bg-warning text-dark';
                dayText = 'Tomorrow';
            }
            
            return `
                <div class="list-group-item event-item">
                    <div class="d-flex w-100 justify-content-between align-items-center">
                        <h5 class="mb-1">${event.title}</h5>
                        <span class="badge ${badgeClass}">${dayText}</span>
                    </div>
                    <p class="mb-1">
                        <i class="bi bi-clock"></i> ${eventDate.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                    <p class="mb-1"><i class="bi bi-geo-alt"></i> ${event.location}</p>
                    <p class="mb-0">${event.description}</p>
                </div>
            `;
        }).join('');
    }
}

// Complaint submission handler
async function handleComplaintSubmit(e) {
    e.preventDefault();
    const complaintText = document.getElementById('complaintText').value;
    const userData = JSON.parse(sessionStorage.getItem('hostelUser'));
    
    if (!complaintText.trim()) {
        alert('Please enter a complaint');
        return;
    }

    try {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Submitting...';
        
        await apiCall('/complaints', 'POST', {
            student_id: userData.userId,
            complaint_text: complaintText
        });
        
        alert('Complaint submitted successfully!');
        e.target.reset();
        loadStudentData(userData.userId);
    } catch (error) {
        alert(`Error submitting complaint: ${error.message}`);
    } finally {
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit';
    }
}

// Helper function to show loading state
function addLoadingState(elementId) {
    const element = document.getElementById(elementId);
    if (element) {
        element.innerHTML = `
            <div class="text-center py-3">
                <div class="spinner-border text-primary" role="status">
                    <span class="visually-hidden">Loading...</span>
                </div>
            </div>
        `;
    }
}

// Helper function to show error message
function showErrorMessage(message) {
    const elements = ['roomInfo', 'complaintsList'];
    elements.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = `<div class="alert alert-danger">${message}</div>`;
        }
    });
} 