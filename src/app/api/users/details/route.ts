import { NextRequest, NextResponse } from "next/server";
import { admin } from "@/lib/firebaseAdmin";

export async function GET(req: NextRequest) {
  try {
    // Get emails from query parameters
    const { searchParams } = new URL(req.url);
    const emailsParam = searchParams.get("emails");
    
    // Validate input
    if (!emailsParam) {
      return NextResponse.json(
        { error: "No emails provided" }, 
        { status: 400 }
      );
    }
    
    // Parse the emails array from JSON
    let emails: string[] = [];
    try {
      emails = JSON.parse(emailsParam) as string[];
    } catch (parseError) {
      return NextResponse.json(
        { error: "Invalid emails format. Expected JSON array." }, 
        { status: 400 }
      );
    }
    
    // Filter out invalid emails
    const validEmails = emails.filter(email => 
      email && 
      typeof email === 'string' && 
      email.trim() && 
      email.includes('@')
    );
    
    if (validEmails.length === 0) {
      return NextResponse.json(
        { error: "No valid emails provided" }, 
        { status: 400 }
      );
    }
    
    // Remove duplicates
    const uniqueEmails = [...new Set(validEmails)];
    
    console.log(`📧 Fetching details for ${uniqueEmails.length} users:`, uniqueEmails);
    
    // Fetch user details from Firebase Auth
    const userDetails = [];
    
    for (const email of uniqueEmails) {
      try {
        // Get user by email from Firebase Auth
        const userRecord = await admin.auth().getUserByEmail(email);
        
        userDetails.push({
          email: userRecord.email || email,
          uid: userRecord.uid,
          name: userRecord.displayName || 
                userRecord.email?.split('@')[0]?.replace(/[._-]/g, ' ') || 
                email.split('@')[0],
          displayName: userRecord.displayName,
          photoURL: userRecord.photoURL || null
        });
        
        console.log(`✅ Found user: ${email} -> ${userRecord.displayName || 'No display name'}`);
      } catch (error: any) {
        // If user not found in Firebase, create a basic entry
        console.log(`⚠️ User not found in Firebase: ${email}`);
        
        // Format the email for display
        const nameFromEmail = email.split('@')[0]
          .replace(/[._-]/g, ' ')
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');
        
        userDetails.push({
          email: email,
          uid: null,
          name: nameFromEmail,
          displayName: nameFromEmail,
          photoURL: null
        });
      }
    }
    
    return NextResponse.json(userDetails);
    
  } catch (error: any) {
    console.error("❌ Get User Details Error:", error);
    
    return NextResponse.json(
      { 
        error: error.message || "Failed to fetch user details",
        details: "Check Firebase Admin SDK configuration"
      }, 
      { status: 500 }
    );
  }
}