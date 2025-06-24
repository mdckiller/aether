# Aether - Modular Personal Dashboard

Aether is an interactive web dashboard that allows you to organize and manage personal notes in a modern and flexible interface. The project is designed with a modular architecture that will facilitate future expansion to support different types of content widgets.

## Features

### Current Features
- **📝 Note System**: Create, edit, and organize text notes with a rich editor
- **🎯 Flexible Layout**: Organize notes in customizable columns
- **🖱️ Drag-and-Drop Interface**: Intuitive repositioning of notes
- **🎨 Smart Context Menus**: Automatic positioning of menus to ensure optimal visibility
- **💾 Auto-save**: Real-time content synchronization with the backend
- **📱 Responsive Design**: Adapts to different screen sizes
- **🎨 Customizable Themes**: Multiple color schemes and backgrounds

### Planned Features
- **🔗 Internet Links**: Cards with website previews and online content
- **🌤️ Weather Widgets**: Local weather forecasts and multiple location support
- **🕐 World Clocks**: Display times for different time zones
- **📰 News Feeds**: Customizable news from various sources
- **✅ Task Management**: Reminders and to-do lists
- **📅 Calendar Integration**: Event viewing and management
- **📊 Monitoring Widgets**: Custom metrics tracking

## Technology Stack

- **Frontend**: Vanilla JavaScript, HTML5, CSS3
- **Backend**: Node.js with Express
- **Database**: PostgreSQL
- **Editor**: Quill.js for rich text editing
- **Architecture**: Modular component-based design

## Installation

### Prerequisites
- Node.js (v14 or higher)
- PostgreSQL (v12 or higher)
- npm or yarn

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/yourusername/aether.git
   cd aether
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Database Setup**
   - Create a PostgreSQL database
   - Update the database configuration in `config.yaml`
   - Run the database schema (if available in your setup)

4. **Configuration**
   - Copy `config.local.yaml.example` to `config.local.yaml`
   - Update the configuration with your database credentials and preferences

5. **Start the application**
   ```bash
   npm start
   # or
   node backend.js
   ```

6. **Access the application**
   - Open your browser and navigate to `http://localhost:3000`

## Configuration

The application uses YAML configuration files:
- `config.yaml` - Main configuration
- `config.local.yaml` - Local overrides (not tracked in git)

Key configuration options:
- Database connection settings
- Server port and host
- API endpoints
- Feature flags

## Project Structure

```
aether/
├── backend.js              # Main server file
├── linkapi.js             # API utilities and link processing
├── config.yaml            # Main configuration
├── html/                  # Frontend files
│   ├── index.html        # Main HTML file
│   ├── css/              # Stylesheets
│   │   ├── style.css     # Main styles
│   │   ├── dialog.css    # Dialog components
│   │   └── ...           # Other CSS files
│   └── js/               # JavaScript modules
│       ├── app.js        # Main application logic
│       ├── NotePanel.js  # Note panel component
│       ├── PanelManager.js # Panel management
│       └── ...           # Other JS modules
├── package.json          # Dependencies and scripts
└── README.md            # This file
```

## Development

### Adding New Widget Types

The modular architecture makes it easy to add new types of widgets:

1. Create a new component class following the pattern of `NotePanel.js`
2. Add the widget type to the panel management system
3. Implement the specific UI and functionality
4. Update the database schema if needed

### Code Style
- Use ES6+ features
- Follow consistent naming conventions
- Comment complex logic
- Maintain modular structure

## API

The application provides RESTful APIs for:
- Note management (CRUD operations)
- User preferences
- Layout configuration
- Future widget types

API endpoints are available at `http://localhost:3000/api`

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Roadmap

- [ ] Weather widget integration
- [ ] News feed widgets
- [ ] Calendar integration
- [ ] Task management system
- [ ] Plugin system for custom widgets
- [ ] Mobile app companion
- [ ] Cloud synchronization
- [ ] Multi-user support

## Support

If you encounter any issues or have questions:
- Open an issue on GitHub
- Check the documentation
- Review existing issues for solutions

## Acknowledgments

- Quill.js for the rich text editor
- The open-source community for inspiration and tools
- Contributors and testers

---

**Aether** - Transform your digital workspace into a personalized, efficient dashboard.