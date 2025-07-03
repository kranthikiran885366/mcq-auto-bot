# 🤝 Contributing to Advanced AI MCQ Bot

Welcome to the **Advanced AI MCQ Bot** project by **MVK Solutions**! We're excited that you're interested in contributing to our flagship educational automation product. This guide will help you get started with contributing to our codebase.

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Contributing Guidelines](#contributing-guidelines)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing Requirements](#testing-requirements)
- [Documentation](#documentation)
- [Issue Reporting](#issue-reporting)
- [Feature Requests](#feature-requests)
- [Community](#community)

## 📜 Code of Conduct

### Our Pledge

We pledge to make participation in our project a harassment-free experience for everyone, regardless of age, body size, disability, ethnicity, gender identity and expression, level of experience, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

**Positive behavior includes:**
- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

**Unacceptable behavior includes:**
- The use of sexualized language or imagery
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate

### Enforcement

Instances of abusive, harassing, or otherwise unacceptable behavior may be reported by contacting the project team at [conduct@mvksolutions.com](mailto:conduct@mvksolutions.com). All complaints will be reviewed and investigated promptly and fairly.

## 🚀 Getting Started

### Prerequisites

Before you begin, ensure you have the following installed:

- **Python 3.8+**
- **Node.js 16+**
- **Git**
- **Docker** (optional but recommended)
- **Chrome Browser** (for extension testing)

### Fork and Clone

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/mcq-automation-bot.git
   cd mcq-automation-bot
   ```

3. **Add upstream remote**:
   ```bash
   git remote add upstream https://github.com/mvksolutions/mcq-automation-bot.git
   ```

## 🔧 Development Setup

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# On Windows:
venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Install development dependencies
pip install -r requirements-dev.txt

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration

# Run database migrations
python setup_db.py

# Start development server
python run_server.py
```

### Frontend Setup

```bash
# Install Node.js dependencies
npm install

# Install development dependencies
npm install --dev

# Start development server
npm run dev
```

### Extension Setup

```bash
# Load extension in Chrome
# 1. Open Chrome and go to chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the project root directory
```

### Docker Setup (Alternative)

```bash
# Build and start all services
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## 📝 Contributing Guidelines

### Branch Naming Convention

Use descriptive branch names that follow this pattern:

```
<type>/<short-description>

Examples:
feature/ai-provider-integration
bugfix/mcq-detection-issue
hotfix/security-vulnerability
docs/api-documentation-update
refactor/code-optimization
```

### Commit Message Format

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation only changes
- `style`: Changes that do not affect the meaning of the code
- `refactor`: A code change that neither fixes a bug nor adds a feature
- `perf`: A code change that improves performance
- `test`: Adding missing tests or correcting existing tests
- `chore`: Changes to the build process or auxiliary tools

**Examples:**
```bash
feat(ai): add support for Claude AI provider
fix(detection): resolve MCQ detection in shadow DOM
docs(api): update authentication documentation
test(integration): add tests for batch processing
```

### Development Workflow

1. **Create a new branch** from `develop`:
   ```bash
   git checkout develop
   git pull upstream develop
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes** following our coding standards

3. **Write tests** for your changes

4. **Run the test suite**:
   ```bash
   # Backend tests
   pytest tests/ -v

   # Frontend tests
   npm test

   # E2E tests
   npm run test:e2e
   ```

5. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat(scope): description of changes"
   ```

6. **Push to your fork**:
   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request** on GitHub

## 🔄 Pull Request Process

### Before Submitting

- [ ] Code follows our style guidelines
- [ ] Self-review of code completed
- [ ] Tests added for new functionality
- [ ] All tests pass locally
- [ ] Documentation updated if needed
- [ ] No merge conflicts with target branch

### PR Template

When creating a pull request, use this template:

```markdown
## Description
Brief description of changes made.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] E2E tests pass
- [ ] Manual testing completed

## Screenshots (if applicable)
Add screenshots to help explain your changes.

## Checklist
- [ ] My code follows the style guidelines
- [ ] I have performed a self-review
- [ ] I have commented my code, particularly in hard-to-understand areas
- [ ] I have made corresponding changes to the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix is effective or that my feature works
- [ ] New and existing unit tests pass locally with my changes
```

### Review Process

1. **Automated Checks**: CI/CD pipeline runs automatically
2. **Code Review**: At least one maintainer reviews the code
3. **Testing**: Reviewers may test the changes locally
4. **Approval**: Changes must be approved before merging
5. **Merge**: Maintainer merges the PR

### Review Criteria

- **Functionality**: Does the code work as intended?
- **Code Quality**: Is the code clean, readable, and maintainable?
- **Performance**: Does the code meet performance requirements?
- **Security**: Are there any security concerns?
- **Testing**: Are there adequate tests?
- **Documentation**: Is documentation updated?

## 🎨 Coding Standards

### Python (Backend)

**Style Guide**: Follow [PEP 8](https://pep8.org/) with these additions:

```python
# Use type hints
def process_mcq(question: str, options: List[str]) -> Dict[str, Any]:
    """Process MCQ and return result.
    
    Args:
        question: The MCQ question text
        options: List of answer options
        
    Returns:
        Dictionary containing processing results
    """
    pass

# Use descriptive variable names
mcq_detection_results = detect_mcqs(url)
ai_response = get_ai_answer(question, options)

# Use constants for magic numbers
MAX_RETRIES = 3
DEFAULT_TIMEOUT = 30

# Use context managers
with open('file.txt', 'r') as f:
    content = f.read()
```

**Tools:**
- **Formatter**: `black`
- **Linter**: `flake8`
- **Type Checker**: `mypy`
- **Import Sorter**: `isort`

```bash
# Format code
black backend/

# Check style
flake8 backend/

# Check types
mypy backend/

# Sort imports
isort backend/
```

### JavaScript (Frontend/Extension)

**Style Guide**: Follow [Airbnb JavaScript Style Guide](https://github.com/airbnb/javascript)

```javascript
// Use const/let instead of var
const API_BASE_URL = 'https://api.mvksolutions.com/v2';
let currentSession = null;

// Use arrow functions for callbacks
const processResults = (results) => {
  return results.map(result => ({
    id: result.id,
    success: result.success,
    answer: result.answer
  }));
};

// Use async/await instead of promises
async function detectMCQs(url) {
  try {
    const response = await fetch(`${API_BASE_URL}/detect/mcqs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('MCQ detection failed:', error);
    throw error;
  }
}

// Use JSDoc for documentation
/**
 * Processes MCQ automation session
 * @param {string} url - Target URL for MCQ detection
 * @param {Object} config - Automation configuration
 * @param {boolean} config.autoAnswer - Whether to auto-answer questions
 * @param {number} config.delay - Delay between answers in seconds
 * @returns {Promise<Object>} Session results
 */
async function processAutomation(url, config) {
  // Implementation
}
```

**Tools:**
- **Formatter**: `prettier`
- **Linter**: `eslint`

```bash
# Format code
npx prettier --write .

# Check style
npx eslint .

# Fix auto-fixable issues
npx eslint . --fix
```

### CSS/Styling

**Framework**: Tailwind CSS with custom components

```css
/* Use semantic class names */
.mcq-container {
  @apply bg-white rounded-lg shadow-md p-6;
}

.mcq-question {
  @apply text-lg font-semibold text-gray-800 mb-4;
}

.mcq-option {
  @apply flex items-center p-3 rounded-md hover:bg-gray-50 transition-colors;
}

/* Use CSS custom properties for theming */
:root {
  --primary-color: #667eea;
  --secondary-color: #764ba2;
  --accent-color: #f093fb;
  --success-color: #4facfe;
  --warning-color: #fa709a;
  --error-color: #ef4444;
}

/* Mobile-first responsive design */
.dashboard-grid {
  @apply grid grid-cols-1 gap-4;
}

@media (min-width: 768px) {
  .dashboard-grid {
    @apply grid-cols-2;
  }
}

@media (min-width: 1024px) {
  .dashboard-grid {
    @apply grid-cols-3;
  }
}
```

## 🧪 Testing Requirements

### Test Coverage

- **Minimum Coverage**: 80% for all new code
- **Critical Paths**: 100% coverage for security and core functionality
- **Integration Tests**: Required for all API endpoints
- **E2E Tests**: Required for major user workflows

### Test Types

**Unit Tests**:
```python
# backend/tests/unit/test_automation_bot.py
import pytest
from backend.automation_bot import AdvancedMCQBot

class TestAdvancedMCQBot:
    def test_mcq_detection(self):
        bot = AdvancedMCQBot()
        # Test implementation
        assert True
```

**Integration Tests**:
```python
# backend/tests/integration/test_api.py
def test_mcq_detection_endpoint(client):
    response = client.post('/api/detect-mcqs', json={'url': 'test.com'})
    assert response.status_code == 200
```

**E2E Tests**:
```javascript
// tests/e2e/automation.spec.js
test('complete automation workflow', async ({ page }) => {
  await page.goto('http://localhost:8080/test-mcq-page.html');
  // Test implementation
});
```

### Running Tests

```bash
# All tests
make test

# Specific test types
make test-unit
make test-integration
make test-e2e

# With coverage
make test-coverage

# Performance tests
make test-performance
```

## 📚 Documentation

### Code Documentation

**Python**: Use docstrings following [Google Style](https://google.github.io/styleguide/pyguide.html#38-comments-and-docstrings)

```python
def detect_mcqs(url: str, options: Dict[str, Any] = None) -> List[Dict[str, Any]]:
    """Detect MCQs on a webpage.
    
    Args:
        url: The URL to scan for MCQs
        options: Optional configuration for detection
            - include_images: Whether to include image-based MCQs
            - shadow_dom: Whether to scan shadow DOM elements
    
    Returns:
        List of detected MCQ dictionaries, each containing:
            - question: The question text
            - options: List of answer options
            - type: MCQ type (radio, checkbox, etc.)
            - confidence: Detection confidence score
    
    Raises:
        ValueError: If URL is invalid
        ConnectionError: If URL cannot be accessed
        
    Example:
        >>> mcqs = detect_mcqs('https://example.com/quiz')
        >>> print(f"Found {len(mcqs)} MCQs")
    """
```

**JavaScript**: Use JSDoc

```javascript
/**
 * Detects MCQs on the current page
 * @async
 * @function detectMCQs
 * @param {Object} options - Detection options
 * @param {boolean} [options.includeShadowDOM=false] - Include shadow DOM elements
 * @param {string[]} [options.customSelectors=[]] - Custom CSS selectors
 * @returns {Promise<MCQ[]>} Array of detected MCQs
 * @throws {Error} When detection fails
 * 
 * @example
 * const mcqs = await detectMCQs({
 *   includeShadowDOM: true,
 *   customSelectors: ['.question-container']
 * });
 */
```

### API Documentation

Update API documentation in `docs/API.md` when adding new endpoints:

```markdown
#### `POST /api/new-endpoint`

Description of the endpoint.

**Request:**
```json
{
  "parameter": "value"
}
```

**Response:**
```json
{
  "success": true,
  "data": {}
}
```
```

### README Updates

Update relevant README sections when adding features:
- Installation instructions
- Usage examples
- Configuration options
- Troubleshooting

## 🐛 Issue Reporting

### Bug Reports

Use the bug report template:

```markdown
**Bug Description**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected Behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g. Windows 10, macOS 12.0, Ubuntu 20.04]
 - Browser: [e.g. Chrome 96, Firefox 95]
 - Extension Version: [e.g. 2.0.0]
 - Python Version: [e.g. 3.9.7]

**Additional Context**
Add any other context about the problem here.

**Logs**
```
Paste relevant logs here
```
```

### Security Issues

**DO NOT** create public issues for security vulnerabilities. Instead:

1. Email [security@mvksolutions.com](mailto:security@mvksolutions.com)
2. Include detailed description
3. Provide steps to reproduce
4. Allow 90 days for fix before disclosure

## 💡 Feature Requests

Use the feature request template:

```markdown
**Is your feature request related to a problem?**
A clear and concise description of what the problem is.

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.

**Implementation Ideas**
If you have ideas about how this could be implemented, please share them.
```

## 🏷️ Labels and Milestones

### Issue Labels

- **Type**: `bug`, `feature`, `enhancement`, `documentation`
- **Priority**: `critical`, `high`, `medium`, `low`
- **Status**: `needs-triage`, `in-progress`, `blocked`, `ready-for-review`
- **Component**: `backend`, `frontend`, `extension`, `docs`, `ci/cd`
- **Difficulty**: `good-first-issue`, `help-wanted`, `expert-needed`

### Milestones

- **v2.1.0**: Next minor release
- **v2.0.1**: Next patch release
- **Future**: Long-term features

## 🌟 Recognition

### Contributors

We recognize contributors in several ways:

1. **Contributors List**: Added to README.md
2. **Release Notes**: Mentioned in changelog
3. **Hall of Fame**: Featured on website
4. **Swag**: MVK Solutions merchandise for significant contributions

### Contribution Types

We value all types of contributions:

- 💻 **Code**: Bug fixes, features, optimizations
- 📖 **Documentation**: Guides, API docs, tutorials
- 🐛 **Testing**: Bug reports, test cases, QA
- 🎨 **Design**: UI/UX improvements, graphics
- 💡 **Ideas**: Feature suggestions, architecture proposals
- 🌍 **Translation**: Internationalization support
- 📢 **Outreach**: Blog posts, talks, community building

## 🤝 Community

### Communication Channels

- **GitHub Discussions**: For general questions and discussions
- **Discord**: [Join our community](https://discord.gg/mvksolutions)
- **Email**: [developers@mvksolutions.com](mailto:developers@mvksolutions.com)
- **Twitter**: [@MVKSolutions](https://twitter.com/MVKSolutions)

### Community Guidelines

1. **Be Respectful**: Treat everyone with respect and kindness
2. **Be Helpful**: Help others learn and grow
3. **Be Patient**: Remember that everyone has different experience levels
4. **Be Constructive**: Provide constructive feedback and suggestions
5. **Be Inclusive**: Welcome people from all backgrounds

### Events

- **Monthly Community Calls**: First Friday of each month
- **Hackathons**: Quarterly virtual hackathons
- **Conferences**: Presentations at education technology conferences

## 📈 Roadmap Participation

### Feature Planning

We involve the community in feature planning:

1. **RFC Process**: Request for Comments on major features
2. **Community Voting**: Vote on feature priorities
3. **Design Reviews**: Participate in design discussions
4. **Beta Testing**: Early access to new features

### Long-term Vision

Help shape the future of educational automation:

- **AI Integration**: Advanced AI model integration
- **Platform Expansion**: Support for more platforms
- **Enterprise Features**: Advanced enterprise capabilities
- **Mobile Support**: Mobile app development

## 🎓 Learning Resources

### Getting Started

- **Python Tutorial**: [python.org/tutorial](https://docs.python.org/3/tutorial/)
- **JavaScript Guide**: [MDN Web Docs](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide)
- **Chrome Extensions**: [Chrome Developers](https://developer.chrome.com/docs/extensions/)
- **Flask Documentation**: [flask.palletsprojects.com](https://flask.palletsprojects.com/)

### Advanced Topics

- **AI/ML**: [Machine Learning Course](https://www.coursera.org/learn/machine-learning)
- **Web Automation**: [Selenium Documentation](https://selenium-python.readthedocs.io/)
- **DevOps**: [DevOps Roadmap](https://roadmap.sh/devops)
- **Security**: [OWASP Top 10](https://owasp.org/www-project-top-ten/)

## 📞 Support

### Getting Help

1. **Documentation**: Check our comprehensive docs
2. **GitHub Issues**: Search existing issues
3. **Community**: Ask in Discord or GitHub Discussions
4. **Email**: Contact [support@mvksolutions.com](mailto:support@mvksolutions.com)

### Providing Help

Help others by:

1. **Answering Questions**: In Discord and GitHub Discussions
2. **Reviewing PRs**: Provide constructive feedback
3. **Improving Docs**: Fix typos and add examples
4. **Mentoring**: Help new contributors get started

---

## 🙏 Thank You

Thank you for contributing to the **Advanced AI MCQ Bot**! Your contributions help make educational automation more accessible and effective for learners worldwide.

Together, we're building the future of intelligent educational technology. 🚀

---

**Built with ❤️ by MVK Solutions - Empowering Education Through AI Innovation**

*For questions about contributing, contact us at [contributors@mvksolutions.com](mailto:contributors@mvksolutions.com)*