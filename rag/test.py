import requests
import sys
import json
import os

API_KEY = "AIzaSyAostpTJpcrQeko4ZDrForwpBIFgDIAioc"
KNOWLEDGE_FILE = "knowledge.txt"

def get_working_model():
    """بيسأل جوجل عن الموديلات المتاحة للمفتاح ده"""
    url = f"https://generativelanguage.googleapis.com/v1beta/models?key={API_KEY}"
    try:
        response = requests.get(url)
        if response.status_code == 200:
            models = response.json().get('models', [])
            # بندور على أي موديل فيه كلمة gemini ويدعم توليد المحتوى
            for m in models:
                if "generateContent" in m.get("supportedGenerationMethods", []) and "gemini" in m["name"]:
                    return m["name"] 
        return "models/gemini-pro" 
    except:
        return "models/gemini-pro"

def load_knowledge():
    paths = [KNOWLEDGE_FILE, os.path.join("rag", KNOWLEDGE_FILE)]
    for path in paths:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return f.read()
    return ""

def ask_gemini_rag(question):
    # الخطوة 1: نعرف الموديل المتاح فعلياً عندك
    model_name = get_working_model()
    context = load_knowledge()
    
    full_prompt = f"Context:\n{context}\n\nQuestion: {question}"

    # الخطوة 2: بناء الرابط بناءً على الموديل اللي لقيناه
    url = f"https://generativelanguage.googleapis.com/v1beta/{model_name}:generateContent?key={API_KEY}"
    
    payload = {"contents": [{"parts": [{"text": full_prompt}]}]}
    
    try:
        print(f"📡 محاولة استخدام الموديل: {model_name}...")
        response = requests.post(url, json=payload)
        if response.status_code == 200:
            data = response.json()
            return data['candidates'][0]['content']['parts'][0]['text']
        else:
            return f"❌ خطأ {response.status_code}: {response.text}"
    except Exception as e:
        return f"❌ فشل النظام: {str(e)}"

if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(1)
    
    print(ask_gemini_rag(sys.argv[1]))