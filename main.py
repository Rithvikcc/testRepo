"""
Medicine Identification FastAPI Backend
========================================
A backend service that:
1. Accepts medicine images, extracts text via OCR (pytesseract)
2. Identifies the medicine from extracted text
3. Returns detailed medicine information
4. Provides a chat endpoint powered by OpenAI GPT for Q&A about medicines

Run:
    pip install -r requirements.txt
    uvicorn main:app --reload

Example Requests:
    # Upload a medicine image
    curl -X POST "http://localhost:8000/upload" \
         -H "accept: application/json" \
         -F "file=@medicine.jpg"

    # Chat about a medicine
    curl -X POST "http://localhost:8000/chat" \
         -H "Content-Type: application/json" \
         -d '{"medicine_name": "Paracetamol", "question": "What is the recommended dose?"}'
"""

import os
import re
import io
import logging

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel

import pytesseract
from PIL import Image, ImageFilter, ImageEnhance

from openai import OpenAI

# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App initialisation
# ---------------------------------------------------------------------------
app = FastAPI(
    title="Medicine Identification API",
    description="Upload medicine images for identification, or chat about medicines.",
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# OpenAI client  (set OPENAI_API_KEY in your environment before running)
# ---------------------------------------------------------------------------
openai_client = OpenAI(api_key=os.getenv("OPENAI_API_KEY", ""))

# ---------------------------------------------------------------------------
# In-memory medicine database
# ---------------------------------------------------------------------------
MEDICINE_DB: dict[str, dict] = {
    "paracetamol": {
        "name": "Paracetamol",
        "composition": "Paracetamol (Acetaminophen) 500 mg",
        "uses": (
            "Relief of mild to moderate pain (headache, toothache, back pain, "
            "muscle aches, menstrual cramps). Reduction of fever."
        ),
        "side_effects": (
            "Rare at normal doses. Overdose can cause serious liver damage. "
            "Allergic reactions (rash, swelling) are uncommon."
        ),
        "precautions": (
            "Do not exceed 4 g per day for adults. "
            "Avoid alcohol. Use with caution in liver or kidney disease. "
            "Consult a doctor if symptoms persist beyond 3 days."
        ),
    },
    "ibuprofen": {
        "name": "Ibuprofen",
        "composition": "Ibuprofen 400 mg (NSAID)",
        "uses": (
            "Relief of pain, fever, and inflammation. "
            "Used for headaches, dental pain, menstrual pain, and arthritis."
        ),
        "side_effects": (
            "Stomach upset, nausea, heartburn, dizziness. "
            "Long-term use may increase risk of heart attack, stroke, or stomach bleeding."
        ),
        "precautions": (
            "Take with food or milk to reduce stomach irritation. "
            "Avoid if you have peptic ulcers, kidney disease, or are in the last trimester of pregnancy. "
            "Do not combine with other NSAIDs."
        ),
    },
    "amoxicillin": {
        "name": "Amoxicillin",
        "composition": "Amoxicillin trihydrate equivalent to Amoxicillin 500 mg",
        "uses": (
            "Antibiotic used to treat bacterial infections including ear, nose, "
            "throat, urinary tract, skin, and chest infections."
        ),
        "side_effects": (
            "Diarrhoea, nausea, rash, and allergic reactions. "
            "Severe allergic reaction (anaphylaxis) is rare but serious."
        ),
        "precautions": (
            "Complete the full course even if symptoms improve. "
            "Inform your doctor of any penicillin allergy. "
            "Not effective against viral infections (e.g. common cold)."
        ),
    },
    "metformin": {
        "name": "Metformin",
        "composition": "Metformin hydrochloride 500 mg / 850 mg / 1000 mg",
        "uses": (
            "First-line treatment for type 2 diabetes mellitus. "
            "Helps control blood sugar levels alongside diet and exercise."
        ),
        "side_effects": (
            "Nausea, vomiting, diarrhoea, and stomach pain (especially at the start of treatment). "
            "Rare but serious: lactic acidosis."
        ),
        "precautions": (
            "Take with meals to reduce GI side effects. "
            "Avoid in severe kidney or liver disease. "
            "Temporarily stop before contrast dye procedures or major surgery. "
            "Monitor kidney function regularly."
        ),
    },
    "atorvastatin": {
        "name": "Atorvastatin",
        "composition": "Atorvastatin calcium equivalent to Atorvastatin 10 mg / 20 mg / 40 mg",
        "uses": (
            "Lowers LDL ('bad') cholesterol and triglycerides, raises HDL ('good') cholesterol. "
            "Reduces the risk of heart attack and stroke."
        ),
        "side_effects": (
            "Muscle pain or weakness (myalgia), headache, nausea, and joint pain. "
            "Rare: severe muscle breakdown (rhabdomyolysis) or liver problems."
        ),
        "precautions": (
            "Report unexplained muscle pain immediately. "
            "Avoid grapefruit juice (interferes with metabolism). "
            "Not recommended during pregnancy or breastfeeding. "
            "Regular liver function tests may be required."
        ),
    },
    "omeprazole": {
        "name": "Omeprazole",
        "composition": "Omeprazole 20 mg (Proton Pump Inhibitor)",
        "uses": (
            "Treatment and prevention of gastric ulcers, duodenal ulcers, "
            "GERD (acid reflux), and Helicobacter pylori eradication (in combination)."
        ),
        "side_effects": (
            "Headache, diarrhoea, nausea, and abdominal pain. "
            "Long-term use may reduce magnesium and vitamin B12 levels."
        ),
        "precautions": (
            "Take 30–60 minutes before meals for best effect. "
            "Long-term use should be under medical supervision. "
            "Inform your doctor if you have liver disease."
        ),
    },
    "cetirizine": {
        "name": "Cetirizine",
        "composition": "Cetirizine hydrochloride 10 mg (Antihistamine)",
        "uses": (
            "Relief of allergic rhinitis (hay fever), urticaria (hives), "
            "and other allergic skin conditions."
        ),
        "side_effects": (
            "Drowsiness, dry mouth, and headache. "
            "Less sedating than first-generation antihistamines."
        ),
        "precautions": (
            "Use with caution when driving or operating machinery. "
            "Avoid alcohol. "
            "Reduce dose in kidney impairment."
        ),
    },
}

# Alias mapping: common brand/alternate names → DB key
MEDICINE_ALIASES: dict[str, str] = {
    "acetaminophen": "paracetamol",
    "tylenol": "paracetamol",
    "calpol": "paracetamol",
    "advil": "ibuprofen",
    "nurofen": "ibuprofen",
    "motrin": "ibuprofen",
    "augmentin": "amoxicillin",  # (contains amoxicillin)
    "glucophage": "metformin",
    "lipitor": "atorvastatin",
    "prilosec": "omeprazole",
    "losec": "omeprazole",
    "zyrtec": "cetirizine",
    "reactine": "cetirizine",
}

# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------
class ChatRequest(BaseModel):
    medicine_name: str
    question: str


class MedicineResponse(BaseModel):
    name: str
    composition: str
    uses: str
    side_effects: str
    precautions: str


class ChatResponse(BaseModel):
    medicine_name: str
    question: str
    answer: str
    disclaimer: str


# ---------------------------------------------------------------------------
# Helper: Image preprocessing for better OCR accuracy
# ---------------------------------------------------------------------------
def preprocess_image(image: Image.Image) -> Image.Image:
    """
    Enhance the image before passing it to pytesseract:
    - Convert to grayscale
    - Increase contrast
    - Apply a slight sharpening filter
    These steps improve OCR accuracy on medicine packaging.
    """
    image = image.convert("L")                         # Grayscale
    enhancer = ImageEnhance.Contrast(image)
    image = enhancer.enhance(2.0)                      # Boost contrast
    image = image.filter(ImageFilter.SHARPEN)          # Sharpen edges
    return image


# ---------------------------------------------------------------------------
# Helper: Extract and clean OCR text
# ---------------------------------------------------------------------------
def extract_text_from_image(image: Image.Image) -> str:
    """
    Run pytesseract OCR on the (preprocessed) image and return clean text.
    Raises HTTPException on OCR failure.
    """
    try:
        processed = preprocess_image(image)
        raw_text: str = pytesseract.image_to_string(processed)
        # Collapse whitespace and remove non-printable characters
        cleaned = re.sub(r"[^\x20-\x7E\n]", "", raw_text)
        cleaned = re.sub(r"[ \t]+", " ", cleaned).strip()
        logger.info("OCR extracted %d characters", len(cleaned))
        return cleaned
    except Exception as exc:
        logger.exception("OCR processing failed")
        raise HTTPException(
            status_code=422,
            detail=f"OCR processing failed: {str(exc)}",
        ) from exc


# ---------------------------------------------------------------------------
# Helper: Detect medicine name from OCR text
# ---------------------------------------------------------------------------
def detect_medicine_name(ocr_text: str) -> str | None:
    """
    Scan the OCR text for known medicine names / aliases.
    Returns the canonical DB key (lowercase) or None if no match is found.

    Strategy (MVP keyword matching):
    1. Normalise text to lowercase.
    2. Check each token against MEDICINE_DB keys and MEDICINE_ALIASES.
    3. Return the first match found.
    """
    normalised = ocr_text.lower()
    # Remove punctuation for cleaner token matching
    normalised = re.sub(r"[^a-z0-9\s]", " ", normalised)
    tokens = normalised.split()

    for token in tokens:
        if token in MEDICINE_DB:
            return token
        if token in MEDICINE_ALIASES:
            return MEDICINE_ALIASES[token]

    # Fallback: substring search for multi-word or partial names
    for key in MEDICINE_DB:
        if key in normalised:
            return key
    for alias, key in MEDICINE_ALIASES.items():
        if alias in normalised:
            return key

    return None


# ---------------------------------------------------------------------------
# Helper: Lookup medicine in DB
# ---------------------------------------------------------------------------
def lookup_medicine(name: str) -> dict | None:
    """Return medicine info dict or None if not found."""
    key = name.strip().lower()
    if key in MEDICINE_DB:
        return MEDICINE_DB[key]
    if key in MEDICINE_ALIASES:
        return MEDICINE_DB[MEDICINE_ALIASES[key]]
    return None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/", summary="Health check")
def root():
    """Simple health-check endpoint."""
    return {"status": "ok", "message": "Medicine Identification API is running."}


@app.post(
    "/upload",
    response_model=MedicineResponse,
    summary="Upload a medicine image for identification",
    responses={
        404: {"description": "Medicine not found in database"},
        422: {"description": "OCR processing failed or invalid file"},
    },
)
async def upload_medicine_image(file: UploadFile = File(...)):
    """
    **Upload a medicine image** (JPG, PNG, BMP, etc.).

    Steps:
    1. Read the uploaded image.
    2. Run OCR to extract text.
    3. Detect the medicine name from the extracted text.
    4. Return medicine details from the in-memory database.
    """
    # Validate content type (basic check)
    allowed_types = {"image/jpeg", "image/png", "image/bmp", "image/tiff", "image/webp"}
    if file.content_type and file.content_type not in allowed_types:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Please upload an image.",
        )

    # Read image bytes
    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    try:
        image = Image.open(io.BytesIO(image_bytes))
    except Exception as exc:
        raise HTTPException(
            status_code=422, detail=f"Cannot open image: {str(exc)}"
        ) from exc

    # OCR
    ocr_text = extract_text_from_image(image)
    if not ocr_text:
        raise HTTPException(
            status_code=422,
            detail="No text could be extracted from the image. Ensure the image is clear.",
        )

    logger.info("OCR text (first 200 chars): %s", ocr_text[:200])

    # Medicine detection
    medicine_key = detect_medicine_name(ocr_text)
    if not medicine_key:
        raise HTTPException(
            status_code=404,
            detail=(
                "Could not identify a medicine from the image. "
                "Ensure the medicine name is clearly visible."
            ),
        )

    medicine = MEDICINE_DB[medicine_key]
    logger.info("Identified medicine: %s", medicine["name"])
    return medicine


@app.post(
    "/chat",
    response_model=ChatResponse,
    summary="Ask a question about a medicine using GPT",
    responses={
        404: {"description": "Medicine not found in database"},
        503: {"description": "OpenAI API unavailable"},
    },
)
def chat_about_medicine(request: ChatRequest):
    """
    **Chat about a medicine** using OpenAI GPT.

    Provide the medicine name and your question.
    The response always includes a safety disclaimer.
    """
    if not request.medicine_name.strip():
        raise HTTPException(status_code=400, detail="medicine_name cannot be empty.")
    if not request.question.strip():
        raise HTTPException(status_code=400, detail="question cannot be empty.")

    # Look up medicine context
    medicine = lookup_medicine(request.medicine_name)
    if not medicine:
        raise HTTPException(
            status_code=404,
            detail=f"Medicine '{request.medicine_name}' not found in the database.",
        )

    if not openai_client.api_key:
        raise HTTPException(
            status_code=503,
            detail="OpenAI API key is not configured. Set the OPENAI_API_KEY environment variable.",
        )

    # Build the prompt with medicine context
    system_prompt = (
        "You are a helpful, knowledgeable pharmacist assistant. "
        "Answer questions about medicines accurately and concisely. "
        "Always remind the user that your response is not a substitute for professional medical advice."
    )

    user_prompt = f"""Medicine Information:
- Name: {medicine['name']}
- Composition: {medicine['composition']}
- Uses: {medicine['uses']}
- Side Effects: {medicine['side_effects']}
- Precautions: {medicine['precautions']}

User Question: {request.question}

Please answer based on the above information."""

    try:
        response = openai_client.chat.completions.create(
            model="gpt-4o",          # Use latest capable model; fallback to gpt-4 if needed
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
            max_tokens=512,
            temperature=0.3,         # Lower temperature for factual / medical content
        )
        answer = response.choices[0].message.content.strip()
    except Exception as exc:
        logger.exception("OpenAI API call failed")
        raise HTTPException(
            status_code=503,
            detail=f"Failed to get a response from OpenAI: {str(exc)}",
        ) from exc

    return ChatResponse(
        medicine_name=medicine["name"],
        question=request.question,
        answer=answer,
        disclaimer="⚠️  This is not medical advice. Always consult a qualified doctor or pharmacist.",
    )


@app.get(
    "/medicines",
    summary="List all medicines in the database",
)
def list_medicines():
    """Returns a list of all medicine names available in the in-memory database."""
    return {"medicines": [info["name"] for info in MEDICINE_DB.values()]}


@app.get(
    "/medicines/{medicine_name}",
    response_model=MedicineResponse,
    summary="Get details for a specific medicine by name",
)
def get_medicine(medicine_name: str):
    """
    Retrieve full details for a single medicine.
    Accepts both generic names (paracetamol) and common brand names (Tylenol).
    """
    medicine = lookup_medicine(medicine_name)
    if not medicine:
        raise HTTPException(
            status_code=404,
            detail=f"Medicine '{medicine_name}' not found.",
        )
    return medicine
