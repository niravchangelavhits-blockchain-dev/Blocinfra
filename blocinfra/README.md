# BlocInfra - Pharmaceutical Supply Chain Demo

A comprehensive blockchain infrastructure demo for pharmaceutical supply chain management using Hyperledger Fabric and React.

## 🏗️ Project Structure

```
blockinfra/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── fabric-config.js
│   │   │   └── constants.js
│   │   ├── services/
│   │   │   ├── fabricService.js
│   │   │   └── dataGenerator.js
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── chaincodeController.js
│   │   │   └── traceController.js
│   │   ├── middleware/
│   │   │   └── authMiddleware.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── chaincode.js
│   │   │   └── trace.js
│   │   └── app.js
│   ├── package.json
│   └── .env
├── frontend/
│   ├── public/
│   │   └── index.html
│   ├── src/
│   │   ├── components/
│   │   │   ├── Login.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── DataGenerator.jsx
│   │   │   └── TraceViewer.jsx
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── App.jsx
│   │   ├── index.jsx
│   │   └── styles.css
│   ├── package.json
│   └── vite.config.js
└── README.md
```

## 🚀 Features

### 🔐 Authentication
- Login with Organization 1 or Organization 2 admin credentials
- JWT-based session management
- Secure logout functionality

### 📊 Dashboard
- Real-time supply chain statistics
- Shipment and order management
- Interactive data visualization

### 🏭 Data Generator
- Generate dummy pharmaceutical supply chain data
- Create strips, boxes, cartons, shipments, and orders
- Configurable data generation parameters

### 🔍 Trace Scanner
- Barcode/transaction hash scanning
- Complete supply chain hierarchy visualization
- Parent-child relationship tracking
- Detailed transaction information display

## 🛠️ Technology Stack

### Backend
- **Node.js** - Runtime environment
- **Express.js** - Web framework
- **Hyperledger Fabric SDK** - Blockchain interaction
- **JWT** - Authentication tokens
- **CORS** - Cross-origin resource sharing
- **Helmet** - Security headers
- **Morgan** - HTTP request logging

### Frontend
- **React 18** - UI framework
- **Vite** - Build tool and dev server
- **CSS3** - Styling with modern features
- **Responsive Design** - Mobile-friendly interface

## 📋 Prerequisites

### Software Requirements
- Node.js 16.0+ 
- npm 8.0+
- Git

### Hyperledger Fabric Network
- Running Fabric test network
- Deployed pharma chaincode
- Organization 1 and Organization 2 configured

## 🚀 Quick Start

### 1. Backend Setup

```bash
# Navigate to backend directory
cd blockinfra/backend

# Install dependencies
npm install

# Start development server
npm run dev

# For production
npm start
```

### 2. Frontend Setup

```bash
# Navigate to frontend directory
cd blockinfra/frontend

# Install dependencies
npm install

# Start development server
npm run dev

# For production build
npm run build
```

### 3. Access the Application

- **Backend API**: http://localhost:3001
- **Frontend App**: http://localhost:3000
- **API Documentation**: http://localhost:3001/

## 🔐 Default Credentials

### Organization 1
- **Username**: admin
- **Password**: adminpw

### Organization 2  
- **Username**: admin
- **Password**: adminpw

## 📡 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout

### Chaincode Operations
- `POST /api/chaincode/generate-data` - Generate dummy data
- `GET /api/chaincode/dashboard` - Get dashboard statistics
- `GET /api/chaincode/transaction` - Get transaction details

### Trace Operations
- `POST /api/trace/scan` - Scan barcode/transaction hash
- `GET /api/trace/hierarchy` - Get trace hierarchy

## 🎯 Usage Examples

### 1. Login and Generate Data
1. Open http://localhost:3000 in browser
2. Select Organization 1 or 2
3. Enter admin credentials
4. Navigate to Dashboard
5. Click "Generate Dummy Data" to populate blockchain

### 2. Trace Transactions
1. Navigate to Trace Scanner
2. Enter transaction hash from any blockchain transaction
3. View complete supply chain hierarchy
4. See parent-child relationships and transaction details

### 3. Monitor Supply Chain
1. View Dashboard for real-time statistics
2. Track shipments, orders, and inventory
3. Monitor transaction flow and status changes

## 🔧 Configuration

### Backend Environment Variables (.env)
```env
NODE_ENV=development
PORT=3001
CORS_ORIGIN=http://localhost:3000
```

### Frontend Configuration
- **Dev Server**: Port 3000
- **API Base URL**: http://localhost:3001/api
- **Build Output**: dist/

## 🎨 UI Features

### Responsive Design
- Mobile-friendly layout
- Adaptive grid systems
- Touch-optimized interactions

### Visual Feedback
- Loading states and spinners
- Success/error messaging
- Interactive hover states
- Color-coded status indicators

### Accessibility
- Semantic HTML structure
- ARIA labels where appropriate
- Keyboard navigation support
- High contrast colors

## 🔒 Security Features

### Authentication
- JWT token-based authentication
- Session timeout handling
- Secure credential storage

### API Security
- CORS configuration
- Helmet.js security headers
- Request rate limiting ready
- Input validation and sanitization

## 🐛 Troubleshooting

### Common Issues

#### Backend Won't Start
```bash
# Check if port 3001 is in use
lsof -i :3001

# Kill existing process
kill -9 <PID>
```

#### Frontend Build Errors
```bash
# Clear node modules
rm -rf node_modules package-lock.json

# Reinstall dependencies
npm install
```

#### Connection Issues
1. Ensure Fabric network is running
2. Check chaincode is deployed
3. Verify API endpoints are accessible
4. Check browser console for errors

## 📝 Development Notes

### Code Structure
- Modular component architecture
- Service layer for API calls
- Middleware for authentication
- Route-based organization

### Best Practices
- Error handling with user feedback
- Loading states for better UX
- Responsive design principles
- Security-first development

### Testing
- API endpoint testing
- Component unit testing
- Integration testing with Fabric network

## 🤝 Contributing

1. Fork the repository
2. Create feature branch
3. Follow coding standards
4. Test thoroughly
5. Submit pull request

## 📄 License

MIT License - Free for commercial and personal use

---

**Built with ❤️ for pharmaceutical supply chain transparency and security**
