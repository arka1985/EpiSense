# EpiSense Research Suite: Comprehensive Project Guide (v10.0)

Welcome to **EpiSense**, an all-in-one, high-fidelity research and epidemiology suite designed for medical students, public health researchers, and beginners. Developed by **Dr. Arkaprabha Sau**, this suite balances academic rigor with intuitive design, making complex statistical and epidemiological concepts accessible through interactive visualizations and medical analogies.

## Core Principles & Accessibility
-   **100% Free of Cost**: Open-source and accessible to everyone.
-   **Privacy-First (No-Database)**: EpiSense does not link to any external database. All data processing occurs locally in your browser. No personal or research data is collected or stored on our servers.
-   **Open Source**: The entire codebase is open for transparency and community improvement.
-   **Beginner-Friendly**: Integrated "Beginner's Keys" use medical analogies to explain complex parameters (e.g., comparing "Sigma" to a disease's "incubation window").

---

## Module-by-Module Breakdown

### 1. Research Design & Methodology
*   **Purpose**: The foundational tile for structuring scientific inquiry.
*   **Sub-Modules & Tabs**:
    *   **Types of Epidemiological Research**: Detailed guide to Observational (Descriptive/Analytical) vs. Experimental studies.
    *   **Randomization Lab**: Interactive tool for Simple, Blocked, and Stratified randomization.
    *   **Matching & Blinding**: Logic for Case-Control matching and Single/Double/Triple-blind trial design.
    *   **Sampling Techniques**: Visual guide to Probability (Simple Random, Systematic, Stratified, Cluster) vs. Non-Probability sampling.
    *   **Bradford Hill Criteria**: Interactive checklist for establishing causality in epidemiology.

### 2. Basic Statistical Visuals (Stats Viz)
*   **Purpose**: Understanding the "Shape" and "Pulse" of data.
*   **Key Features**:
    *   **Central Limit Theorem (CLT) Playground**: Simulate coin tosses or dice rolls and watch the Normal Distribution emerge.
    *   **Probability Distribution Lab**: Interactive curves for Normal, T, Chi-Square, and F-distributions.
    *   **Shape Analysis**: Dynamic sliders to manipulate **Skewness** and **Kurtosis** with real-time visual feedback.
    *   **Z-Score Morphing**: Visualize how individual data points map to standard deviations.

### 3. Sample Size Calculator
*   **Purpose**: Determining the statistical power needed for a study.
*   **Supported Designs**:
    *   **Prevalence Studies**: (Cross-sectional) with Finite Population Correction.
    *   **Case-Control & Cohort Studies**: Uses Kelsey and Fleiss methods with 1:M ratio support.
    *   **RCT & Superiority Trials**: Precision-based calculations for clinical interventions.
    *   **IT-T (Intention-To-Treat)**: Basic logic and adjustments for attrition.

### 4. Statistical Tests Wizard
*   **Purpose**: A step-by-step diagnostic tool to choose the correct test.
*   **Advanced Logic**:
    *   **Interactive Selector**: Guides you from "Goal" (Comparison, Correlation, Prediction) to specific tests.
    *   **Normality Checkers**: Integrated Q-Q plots, Kolmogorov-Smirnov, and D'Agostino-Pearson tests.
    *   **Comparison Engine**: Supports Parametric (T-test, ANOVA) and Non-Parametric (Mann-Whitney, Kruskal-Wallis) equivalents.
    *   **Post-hoc Lab**: Bonferroni and Tukey’s HSD adjustments for multiple comparisons.

### 5. Data Visualization Lab
*   **Purpose**: Transforming raw CSV/Excel data into publication-ready figures.
*   **Supported Plots**: Bar, Pie, Histograms, Box Plots, Scatter Plots, Line Graphs, KDE (Kernel Density Estimation), and Regression lines.
*   **Features**: Custom binning for histograms, categorical grouping with curated color palettes, and High-Res PNG/SVG exports.

### 6. Screening & Diagnostic Tests
*   **Purpose**: Evaluating clinical testing accuracy.
*   **High-Fidelity Features**:
    *   **Monte Carlo Simulations**: Dynamic PPV/NPV modeling based on changing prevalence.
    *   **Sequential vs. Parallel Testing**: Compare "Increase Sensitivity" vs. "Increase Specificity" logic.
    *   **Interactive AUC-ROC**: Drag threshold sliders and watch the ROC curve and Youden Index change in real-time.

### 7. Machine Learning Basics (Ethical AI Lab)
*   **Purpose**: Simplified introduction to clinical AI modeling.
*   **Demos & Interactive Labs**:
    *   **Clinical Decision Trees**: Visualize Tumor Size vs. Cell Uniformity classification.
    *   **Neural Network Inspector**: SVG-based architecture with forward-pass neuron highlights.
    *   **Ethical AI Lab**: Reinforcement Learning for sepsis dosing (Reward/Penalty logic) and Attention-mechanism visualization for Transformers.
    *   **Bias-Variance Playground**: Interactive demonstration of Overfitting vs. Underfitting.

### 8. Data Collection & Geospatial Mapping (GIS)
*   **Purpose**: Case mapping and outbreak investigation.
*   **Features**:
    *   **Geospatial Clustering**: Distance-based outbreak detection.
    *   **India-Specific Choropleths**: Thematic mapping at National, State, and District levels for Indian healthcare metrics.
    *   **GPS Integration**: Capture exact device coordinates for field-based case reporting.
    *   **Custom Map Designer**: Switch between Dark, Blue, Light, and Minimal base maps for professional GIS reports.

### 9. Mathematical Modeling
*   **Purpose**: Modeling the trajectory of infectious diseases.
*   **Models Included**: SIR, SEIR (with Exposure state), and SIS models.
*   **Technical Rigor**:
    *   **Differential Equations**: Real-time MathJax rendering of ODEs.
    *   **R₀ Calculator**: Dynamic Basic Reproduction Number calculation based on transmission/recovery sliders.
    *   **Empirical Comparison**: Upload CSV data to overlay actual outbreak curves on theoretical models.

### 10. Language & Accessibility (Translation)
*   **Purpose**: Making research inclusive for non-English speaking participants.
*   **Document Translation**: Full-page integration with the **Bhashini app of Government of India (v3)**. Translate consent forms and questionnaires into multiple Indian regional languages with high fidelity.
*   **Speech-to-Text (STT) & Dual-Transcription**:
    *   Real-time Indian language transcription alongside an English translation canvas.
    *   Powered by **MyMemory API** and **Web Speech API**.
    *   Download side-by-side Dual-Docs (.doc) for ethical research documentation.

### 11. Qualitative Research & Analysis
*   **Purpose**: Inductive analysis of themes and human experiences.
*   **Workflow**:
    *   **Interactive Thematic Coding**: Highlight transcript segments and assign thematic "Codes".
    *   **Word Cloud Generator**: Instant visualization of transcript word frequency.
    *   **Thematic Report Export**: Exports grouped snippets and frequency charts directly to Word format.

### 12. Referencing & Bibliography Builder
*   **Purpose**: Automating academic citations for manuscripts.
*   **Supported Styles**: APA (7th), AMA (11th), Vancouver, IEEE, Harvard, The Lancet, and Nature.
*   **Intelligence**: Automatic "et al." formatting and rich-text (Italics/Bold) preservation during clipboard copy and Word export.

---

## Technical Stack
EpiSense is built using modern, lightweight web technologies for maximum portability as a **Progressive Web App (PWA)**:
-   **Structure**: HTML5, Vanilla JavaScript.
-   **Styling**: Modern CSS3 (Glassmorphism, Neon Pulses).
-   **Libraries**: Chart.js (Plots), Plotly.js (Advanced Viz), Leaflet.js (GIS Mapping), MathJax (Equations), WordCloud2.js (Qualitative), SheetJS (Excel Processing).
-   **APIs**: Bhashini v3 (GOI), MyMemory API.

---

## Project Disclaimer & Acknowledgment
-   **Academic Tool**: While EpiSense follows rigorous mathematical standards, it is primarily intended for educational and research training purposes. Users are requested to always verify results with standard standard textbooks or consult with a human expert/statistician for critical clinical decisions.
-   **Generosity of Use**: Researchers and students are requested to use this app generously.
-   **Feedback**: If any bugs are identified or if you wish to request a new feature, please write an email to the developer: **Dr. Arkaprabha Sau** at [arka_sau@example.com] (Placeholder - please contact directly).

*EpiSense: Empowering Researchers, one data point at a time.*
