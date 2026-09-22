# Gharmitra Number Masking Setup Guide (Swiggy / Zomato Pattern)

या फोल्डरमध्ये Swiggy, Zomato आणि Uber प्रमाणे **नंबर मास्किंग (Call Masking)** प्रत्यक्ष सिम कार्ड कॉलिंगसाठी कसे सेट करायचे याचे मार्गदर्शन दिले आहे.

---

## १. दोन कॉलिंग पर्याय कसे काम करतात?

### पर्याय अ: In-App WebRTC Calling (सध्या ॲक्टिव्ह - मोफत)
- ब्राऊझर टू ब्राऊझर इंटरनेट ऑडिओ कॉल.
- **खर्च:** ₹० (शून्य रुपये).
- **नंबर एक्सपोजर:** ०% (कोणत्याही सिम कार्ड नंबरची देवाणघेवाण होत नाही).
- हे फिचर `customer.html` आणि `worker.html` मध्ये तात्काळ सुरू आहे.

---

### पर्याय ब: Cloud Telephony Bridge Call (Exotel / Twilio - प्रत्यक्ष फोन कॉलिंग)
जेव्हा युझरकडे इंटरनेट नसेल आणि त्याला साध्या सेल्युलर फोनवरून कॉल करायचा असेल:

1. **Exotel (भारतातील #1 कंपनी - Swiggy, Zomato, Ola वापरतात):**
   - [exotel.com](https://exotel.com/) वर जाऊन व्यवसाय खाते सुरू करा.
   - एक व्हर्च्युअल लँडलाईन किंवा मोबाईल नंबर (उदा. `020 7195 XXXX` किंवा `+91 80 4710 XXXX`) खरेदी करा.
   - API Keys (Account SID, API Key, API Token) मिळवा.

2. **हे कसे काम करते:**
   - जेव्हा ग्राहक ॲपमध्ये "Call Worker" दाबतो, तेव्हा आमचे `initiateExotelMaskedCall` फंक्शन Exotel API ला विनंती पाठवते.
   - Exotel प्रथम ग्राहकाच्या खऱ्या फोनवर कॉल लावते (Caller ID = व्हर्च्युअल नंबर).
   - ग्राहकाने फोन उचलल्यावर, वर्करच्या फोनवर त्याच व्हर्च्युअल नंबरवरून कॉल जातो.
   - **निकाल:** दोघांनाही स्क्रीनवर फक्त Gharmitra चा व्हर्च्युअल नंबर दिसतो, कोणाचाही मूळ नंबर समोरच्याला दिसत नाही.

3. **डिप्लॉयमेंट (Firebase Functions):**
   ```bash
   firebase init functions
   # telephony_functions.js मधील कोड functions/index.js मध्ये ठेवा
   firebase deploy --only functions
   ```

4. **Environment Variables:**
   ```bash
   firebase functions:config:set exotel.sid="YOUR_SID" exotel.key="YOUR_KEY" exotel.token="YOUR_TOKEN" exotel.virtual_number="02071954421"
   ```
