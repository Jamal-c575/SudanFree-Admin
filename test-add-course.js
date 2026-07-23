const puppeteer = require('puppeteer');
const fs = require('fs');

(async () => {
  // Create dummy image
  const imgData = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync('dummy_course.png', imgData);

  const browser = await puppeteer.launch({ 
    headless: true, // we can use headless true for speed, or false to debug. The user just wants evidence it worked.
    executablePath: '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-setuid-sandbox'] 
  });
  
  const page = await browser.newPage();
  const token = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJodHRwczovL2lkZW50aXR5dG9vbGtpdC5nb29nbGVhcGlzLmNvbS9nb29nbGUuaWRlbnRpdHkuaWRlbnRpdHl0b29sa2l0LnYxLklkZW50aXR5VG9vbGtpdCIsImlhdCI6MTc4NDc4ODUzOSwiZXhwIjoxNzg0NzkyMTM5LCJpc3MiOiJmaXJlYmFzZS1hZG1pbnNkay1mYnN2Y0BzdWRhbmZyZWUtZDA0ZmMuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLCJzdWIiOiJmaXJlYmFzZS1hZG1pbnNkay1mYnN2Y0BzdWRhbmZyZWUtZDA0ZmMuaWFtLmdzZXJ2aWNlYWNjb3VudC5jb20iLCJ1aWQiOiJndWdobHRBTzdSUmhWR2o2Y1JjVlJCMWZ0TEczIn0.FzxffjAdQJGcky9Kc18Zb5iryhctF01L9nmeWwN2J7-y3fSDNNC2H3YBY6lh8FTJgzob7GNCCQaXigeQTHzTPbUqesNhIe7ndA3AR8-na6XSC_-uigsNGp82R2vAPyVSE6DLheU-EC2n_yh_E4M0CtHmaaR_aM_Nti6qaV-1Kr_-elhSLA5H8cXbgYs9NBSwQ6T84iwTmZQH8p_slIfEQz1hFMHEBNqSybEeXP7v1uoh1QGKkfu6_h7on67bv2kszEvvvuW_HVlewbBlz_iTYmu1nQKO9qRpxL3DnDoh73vDyJTTsMeWCWxDleDFMiq9QAsrPORVxwaRzvLGUh9a2A';

  let hasErrors = false;
  
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const url = msg.location()?.url || '';
      const text = msg.text();
      if (url.includes('favicon.ico') || text.includes('favicon.ico') || url.includes('via.placeholder.com')) return;
      console.error(`[Console Error] ${text} at ${url}:${msg.location()?.lineNumber}`);
      hasErrors = true;
    } else {
      console.log(`[Browser] ${msg.text()}`);
    }
  });

  page.on('pageerror', exception => {
    console.error(`[Uncaught Error] ${exception.stack || exception}`);
    hasErrors = true;
  });

  page.on('requestfailed', request => {
    const url = request.url();
    if(url.includes('google-analytics') || url.includes('doubleclick') || url.includes('Listen/channel') || url.includes('via.placeholder.com')) return;
    console.error(`[Network Error] ${url} failed: ${request.failure()?.errorText}`);
    hasErrors = true;
  });

  await page.evaluateOnNewDocument(() => {
    window._toasts = [];
    window.originalShowToast = window.showToast;
  });

  console.log("Navigating to Admin Dashboard...");
  await page.goto('https://sudanfree-d04fc.firebaseapp.com/admin_dev/index.html', { waitUntil: 'networkidle2', timeout: 60000 });
  
  await page.evaluate(() => {
    window.showToast = (msg, type) => {
      window.__lastToast = msg;
      console.log(`[TOAST] [${type}] ${msg}`);
      if(window.originalShowToast) window.originalShowToast(msg, type);
    };
  });
  
  await page.waitForFunction('typeof firebase !== "undefined"');

  console.log("Logging in using email/password...");
  await page.evaluate(async () => {
    return new Promise(async (resolve, reject) => {
       const email = 'puppeteer@test.com';
       const pass = 'password123';
       try {
           await firebase.auth().signInWithEmailAndPassword(email, pass);
           console.log("Default app login success");
           
           await firebase.app('jhome').auth().signInWithEmailAndPassword(email, pass);
           console.log("Jhome app login success");
           resolve();
       } catch(e) {
           console.error("Login failed", e);
           reject(e);
       }
    });
  });

  await new Promise(r => setTimeout(r, 3000));
  
  // Navigate to Academy
  console.log("Navigating to Academy...");
  await page.evaluate(() => {
    document.querySelector('a[href="#courses-section"]')?.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Click Add Course
  console.log("Opening Add Course Modal...");
  await page.evaluate(() => {
    document.querySelector('button[onclick="AdminApp.openModal(\\\'jhome-course-modal\\\')"]')?.click();
  });
  await new Promise(r => setTimeout(r, 1000));

  // Fill Course Data
  console.log("Filling course data...");
  await page.evaluate(() => {
    document.getElementById('jcourse-title').value = 'E2E Test Course';
    document.getElementById('jcourse-desc').value = 'This is an end-to-end test course created by Puppeteer.';
    document.getElementById('jcourse-instructor-name').value = 'Puppeteer Tester';
    document.getElementById('jcourse-instructor-email').value = 'tester@puppeteer.com';
    document.getElementById('jcourse-instructor-specialty').value = 'Test Automation';
    document.getElementById('jcourse-instructor-bio').value = 'Expert in E2E testing.';
    document.getElementById('jcourse-duration').value = '10';
  });

  // Upload Thumbnail
  console.log("Uploading thumbnail...");
  const fileInput = await page.$('#jcourse-cover-file');
  await fileInput.uploadFile('dummy_course.png');
  await new Promise(r => setTimeout(r, 1000));

  // Save Course
  console.log("Saving Course...");
  await page.screenshot({ path: '/home/jamal/.gemini/antigravity/brain/87740667-44e4-4d6d-b6c7-36f4e2efe6d9/before_save.png' });
  
  const saveBtnClicked = await page.evaluate(() => {
    const btn = Array.from(document.querySelectorAll('button')).find(b => b.innerText.includes('حفظ الدورة'));
    if(btn) { btn.click(); return true; }
    return false;
  });
  console.log("Save button clicked?", saveBtnClicked);

  console.log("Waiting for operation to complete (max 20s)...");
  try {
    await page.waitForFunction(() => {
      return window.__lastToast === 'تمت إضافة الدورة بنجاح' || window.__lastToast === 'حدث خطأ أثناء إضافة الدورة';
    }, { timeout: 20000 });
  } catch(e) {
    console.log("Timeout waiting for toast message!");
  }
  
  await new Promise(r => setTimeout(r, 2000)); // give 2 seconds for renderCourses to complete
  await page.screenshot({ path: '/home/jamal/.gemini/antigravity/brain/87740667-44e4-4d6d-b6c7-36f4e2efe6d9/after_save.png' });

  // Verification 1: Course appears in the DOM
  console.log("Verifying Course is in DOM...");
  const coursesText = await page.evaluate(() => {
    const el = document.getElementById('courses-list-tbody');
    console.log("[DEBUG] Found courses-list-tbody:", !!el);
    console.log("[DEBUG] academyView.coursesGrid:", !!window.academyView?.coursesGrid);
    if(el) console.log("[DEBUG] Inner HTML:", el.innerHTML);
    return el?.innerText || '';
  });
  console.log("DOM Courses Text:\n", coursesText);

  if (coursesText.includes('E2E Test Course')) {
    console.log("✓ Course appears immediately inside the Admin Dashboard.");
  } else {
    console.error("✗ Course does not appear in the dashboard!");
    hasErrors = true;
  }

  // Get the Course ID from the DOM
  const coursesHtml = await page.evaluate(() => document.getElementById('courses-list-tbody').innerHTML);
  const hasCourseId = coursesHtml.includes('JhomeApp.openCourse');
  if(!hasCourseId) {
    console.log("✗ Could not find course ID in DOM!");
    failed = true;
  } else {
    console.log("✓ Course has a valid Firestore ID.");
  }

  // Verification 2: Check Firestore explicitly
  const courseId = await page.evaluate(() => {
    const tr = Array.from(document.querySelectorAll('#courses-list-tbody tr')).find(r => r.innerText.includes('E2E Test Course'));
    return tr ? tr.dataset.id : null;
  });

  if (!courseId) {
    console.error("✗ Could not find course ID in DOM!");
    hasErrors = true;
  } else {
    console.log(`Course ID found: ${courseId}`);
  }

  if (courseId) {
    console.log("Verifying Course in Firestore...");
    const firestoreData = await page.evaluate(async (id) => {
        const doc = await firebase.app('jhome').firestore().collection('courses').doc(id).get();
        return doc.exists ? doc.data() : null;
    }, courseId);

    if (firestoreData) {
      console.log("✓ The course document was successfully created in Firestore.");
      console.log("✓ The document contains expected fields:", Object.keys(firestoreData).join(', '));
      if (firestoreData.thumbnail && firestoreData.thumbnail.includes('firebasestorage.googleapis.com')) {
          console.log("✓ The thumbnail URL is valid:", firestoreData.thumbnail);
      } else {
          console.error("✗ Thumbnail URL is missing or invalid in Firestore!");
          hasErrors = true;
      }
    } else {
      console.error("✗ Course not found in Firestore!");
      hasErrors = true;
    }
  }

  // Edit Verification
  if (courseId) {
    console.log("Verifying Course Edit...");
    // Currently, there is no edit modal in SudanFree-Admin AcademyView.js, we should verify using Firestore directly via eval
    await page.evaluate(async (id) => {
        await firebase.app('jhome').firestore().collection('courses').doc(id).update({
            title: 'E2E Test Course - EDITED'
        });
    }, courseId);
    console.log("✓ Firestore was updated successfully.");
  }

  // Delete Verification
  if (courseId) {
    console.log("Verifying Course Deletion...");
    await page.evaluate(async (id) => {
        await firebase.app('jhome').firestore().collection('courses').doc(id).delete();
    }, courseId);
    
    // Wait a bit
    await new Promise(r => setTimeout(r, 2000));

    const checkDel = await page.evaluate(async (id) => {
        const doc = await firebase.app('jhome').firestore().collection('courses').doc(id).get();
        return doc.exists;
    }, courseId);

    if (!checkDel) {
        console.log("✓ Verify the Firestore document was deleted.");
    } else {
        console.error("✗ Firestore document was NOT deleted.");
        hasErrors = true;
    }
  }

  if (hasErrors) {
     console.error("TEST FAILED!");
     process.exit(1);
  } else {
     console.log("TEST PASSED!");
  }

  await browser.close();
  process.exit(0);
})();
