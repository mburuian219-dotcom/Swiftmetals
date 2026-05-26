// src/app/api/expenses/route.ts
// @ts-nocheck
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { admin } from "@/lib/firebaseAdmin";

// Helper function to get current user from Firebase session token
async function getCurrentUser(req: Request) {
  try {
    // Get the authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.log("No bearer token found, using system user");
      return {
        email: "system@swiftmetals.com",
        name: "System",
        uid: "system",
      };
    }

    const token = authHeader.split("Bearer ")[1];
    
    // Verify the Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    return {
      email: decodedToken.email || "unknown@swiftmetals.com",
      name: decodedToken.name || decodedToken.email?.split('@')[0] || "User",
      uid: decodedToken.uid,
      phone: decodedToken.phone_number || null,
    };
  } catch (error) {
    console.error("Error verifying Firebase token:", error);
    // Return system user as fallback
    return {
      email: "system@swiftmetals.com",
      name: "System",
      uid: "system",
    };
  }
}

// Helper function to extract creator info from notes
function extractCreatorInfo(notes: string | null) {
  if (!notes) return null;
  
  // Look for pattern: [Created by: name (email) on date]
  const createdMatch = notes.match(/\[Created by: (.*?) \((.*?)\) on (.*?)\]/);
  if (createdMatch) {
    return {
      name: createdMatch[1],
      email: createdMatch[2],
      date: createdMatch[3],
    };
  }
  return null;
}

// Helper function to extract update info from notes
function extractUpdateInfo(notes: string | null) {
  if (!notes) return null;
  
  // Look for pattern: [Updated by: name (email) on date]
  const updateMatch = notes.match(/\[Updated by: (.*?) \((.*?)\) on (.*?)\]/);
  if (updateMatch) {
    return {
      name: updateMatch[1],
      email: updateMatch[2],
      date: updateMatch[3],
    };
  }
  return null;
}

// Helper function to add update info to notes
function addUpdateToNotes(currentNotes: string | null, userName: string, userEmail: string) {
  const currentDateTime = new Date().toLocaleString('en-KE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  
  const updateInfo = `[Updated by: ${userName} (${userEmail}) on ${currentDateTime}]`;
  
  if (!currentNotes) {
    return updateInfo;
  }
  
  // Remove any existing update entries to keep only the latest
  let notesWithoutUpdates = currentNotes.replace(/\[Updated by:.*?\]\n?\n?/g, '');
  notesWithoutUpdates = notesWithoutUpdates.trim();
  
  if (notesWithoutUpdates && !notesWithoutUpdates.includes(updateInfo)) {
    return `${notesWithoutUpdates}\n\n${updateInfo}`;
  }
  
  // If notes contain only the update info, replace it
  if (notesWithoutUpdates === "") {
    return updateInfo;
  }
  
  return currentNotes;
}

// ✅ GET all expenses
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const category = searchParams.get("category");
    const createdBy = searchParams.get("createdBy");
    const search = searchParams.get("search");
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "100");
    
    // Build filter conditions
    let whereCondition: any = {};
    
    // Date range filter
    if (startDate || endDate) {
      whereCondition.date = {};
      if (startDate) whereCondition.date.gte = new Date(startDate);
      if (endDate) whereCondition.date.lte = new Date(endDate);
    }
    
    // Category filter
    if (category && category !== "all") {
      whereCondition.category = category;
    }
    
    // Search filter
    if (search) {
      whereCondition.OR = [
        { title: { contains: search } },
        { category: { contains: search } },
        { notes: { contains: search } },
      ];
    }
    
    // Get total count for pagination
    const totalCount = await prisma.expense.count({
      where: whereCondition,
    });
    
    // Fetch expenses with pagination
    const expenses = await prisma.expense.findMany({
      where: whereCondition,
      orderBy: { date: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    });
    
    // Add computed fields for creator and updater info
    const expensesWithMetadata = expenses.map(expense => {
      const creatorInfo = extractCreatorInfo(expense.notes);
      const updateInfo = extractUpdateInfo(expense.notes);
      
      return {
        ...expense,
        createdBy: creatorInfo?.email || null,
        createdByName: creatorInfo?.name || null,
        createdByEmail: creatorInfo?.email || null,
        createdAtFormatted: creatorInfo?.date || expense.createdAt.toISOString(),
        updatedBy: updateInfo?.email || null,
        updatedByName: updateInfo?.name || null,
        updatedByEmail: updateInfo?.email || null,
        updatedAtFormatted: updateInfo?.date || expense.updatedAt.toISOString(),
      };
    });
    
    // Apply creator filter if needed (post-query since it's in notes)
    let filteredExpenses = expensesWithMetadata;
    if (createdBy && createdBy !== "all") {
      filteredExpenses = expensesWithMetadata.filter(exp => exp.createdBy === createdBy);
    }
    
    // Get unique creators for filter options
    const allExpenses = await prisma.expense.findMany();
    const uniqueCreatorsSet = new Set();
    allExpenses.forEach(expense => {
      const creatorInfo = extractCreatorInfo(expense.notes);
      if (creatorInfo?.email) {
        uniqueCreatorsSet.add(creatorInfo.email);
      }
    });
    const uniqueCreators = Array.from(uniqueCreatorsSet);
    
    // Calculate summary statistics
    const totalAmount = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    const averageAmount = filteredExpenses.length > 0 ? totalAmount / filteredExpenses.length : 0;
    
    // Calculate category breakdown
    const categoryBreakdown = filteredExpenses.reduce((acc, exp) => {
      const cat = exp.category || "Uncategorized";
      acc[cat] = (acc[cat] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate creator breakdown
    const creatorBreakdown = filteredExpenses.reduce((acc, exp) => {
      const creator = exp.createdBy || "system";
      acc[creator] = (acc[creator] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    
    return NextResponse.json({ 
      success: true, 
      expenses: filteredExpenses,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalItems: totalCount,
        itemsPerPage: limit,
      },
      filters: {
        startDate,
        endDate,
        category,
        createdBy,
        search,
      },
      metadata: {
        uniqueCreators,
        totalUniqueCreators: uniqueCreators.length,
      },
      summary: {
        totalAmount,
        averageAmount,
        totalExpenses: filteredExpenses.length,
        categoryBreakdown,
        creatorBreakdown,
      }
    });
  } catch (error) {
    console.error("❌ Error fetching expenses:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch expenses" },
      { status: 500 }
    );
  }
}

// ✅ POST (create new expense)
export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validate required fields
    if (!body.title || !body.title.trim()) {
      return NextResponse.json(
        { success: false, error: "Expense title is required" },
        { status: 400 }
      );
    }

    if (!body.amount || parseFloat(body.amount) <= 0) {
      return NextResponse.json(
        { success: false, error: "Valid expense amount is required" },
        { status: 400 }
      );
    }

    // Get current user info from Firebase
    const currentUser = await getCurrentUser(req);
    const userName = body.createdByName || currentUser.name;
    const userEmail = body.createdByEmail || currentUser.email;
    const currentDateTime = new Date().toLocaleString('en-KE', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Prepare notes with creator information
    let notesWithMeta = body.notes || "";
    const creatorInfo = `[Created by: ${userName} (${userEmail}) on ${currentDateTime}]`;
    
    // Only add creator info if it doesn't already exist
    if (!notesWithMeta.includes("[Created by:")) {
      notesWithMeta = notesWithMeta ? `${notesWithMeta}\n\n${creatorInfo}` : creatorInfo;
    }

    // Try to find staff record by email
    let staffId = null;
    if (userEmail && userEmail !== "system@swiftmetals.com") {
      try {
        const staff = await prisma.staff.findFirst({
          where: { email: userEmail }
        });
        if (staff) {
          staffId = staff.id;
        }
      } catch (err) {
        console.error("Error finding staff:", err);
      }
    }

    // Create the expense
    const expense = await prisma.expense.create({
      data: {
        title: body.title.trim(),
        amount: parseFloat(body.amount),
        category: body.category || null,
        notes: notesWithMeta,
        date: body.date ? new Date(body.date) : new Date(),
        createdById: staffId,
      },
    });

    // Return expense with creator info
    const creatorInfoExtracted = extractCreatorInfo(expense.notes);
    
    return NextResponse.json({ 
      success: true, 
      message: "Expense created successfully",
      expense: {
        ...expense,
        createdBy: creatorInfoExtracted?.email || null,
        createdByName: creatorInfoExtracted?.name || null,
        createdByEmail: creatorInfoExtracted?.email || null,
        createdAtFormatted: creatorInfoExtracted?.date || expense.createdAt.toISOString(),
      }
    });
  } catch (error) {
    console.error("❌ Error creating expense:", error);
    return NextResponse.json(
      { success: false, error: "Failed to create expense. Please try again." },
      { status: 500 }
    );
  }
}

// ✅ PUT (update existing expense)
export async function PUT(req: Request) {
  try {
    const body = await req.json();

    if (!body.id) {
      return NextResponse.json(
        { success: false, error: "Expense ID is required" },
        { status: 400 }
      );
    }

    // Check if expense exists
    const existingExpense = await prisma.expense.findUnique({
      where: { id: Number(body.id) },
    });

    if (!existingExpense) {
      return NextResponse.json(
        { success: false, error: "Expense not found" },
        { status: 404 }
      );
    }

    // Get current user info from Firebase
    const currentUser = await getCurrentUser(req);
    const userName = body.updatedByName || currentUser.name;
    const userEmail = body.updatedByEmail || currentUser.email;

    // Prepare update data
    const updateData: any = {
      title: body.title || existingExpense.title,
      amount: parseFloat(body.amount) || existingExpense.amount,
      category: body.category !== undefined ? body.category : existingExpense.category,
      date: body.date ? new Date(body.date) : existingExpense.date,
    };

    // Add update information to notes
    let updatedNotes = addUpdateToNotes(body.notes || existingExpense.notes, userName, userEmail);
    
    // Preserve original creator info if it exists and wasn't modified
    if (existingExpense.notes && existingExpense.notes.includes("[Created by:") && !updatedNotes.includes("[Created by:")) {
      const createdMatch = existingExpense.notes.match(/\[Created by:.*?\]/);
      if (createdMatch) {
        updatedNotes = `${createdMatch[0]}\n\n${updatedNotes}`;
      }
    }
    
    updateData.notes = updatedNotes;

    // Try to find staff record for updater
    let staffId = null;
    if (userEmail && userEmail !== "system@swiftmetals.com") {
      try {
        const staff = await prisma.staff.findFirst({
          where: { email: userEmail }
        });
        if (staff) {
          staffId = staff.id;
        }
      } catch (err) {
        console.error("Error finding staff:", err);
      }
    }
    
    if (staffId) {
      updateData.updatedById = staffId;
    }

    // Update the expense
    const updatedExpense = await prisma.expense.update({
      where: { id: Number(body.id) },
      data: updateData,
    });

    // Extract all metadata for response
    const creatorInfo = extractCreatorInfo(updatedExpense.notes);
    const updateInfo = extractUpdateInfo(updatedExpense.notes);
    
    return NextResponse.json({ 
      success: true, 
      message: "Expense updated successfully",
      expense: {
        ...updatedExpense,
        createdBy: creatorInfo?.email || null,
        createdByName: creatorInfo?.name || null,
        createdByEmail: creatorInfo?.email || null,
        createdAtFormatted: creatorInfo?.date || updatedExpense.createdAt.toISOString(),
        updatedBy: updateInfo?.email || null,
        updatedByName: updateInfo?.name || null,
        updatedByEmail: updateInfo?.email || null,
        updatedAtFormatted: updateInfo?.date || updatedExpense.updatedAt.toISOString(),
      }
    });
  } catch (error) {
    console.error("❌ Error updating expense:", error);
    return NextResponse.json(
      { success: false, error: "Failed to update expense" },
      { status: 500 }
    );
  }
}

// ✅ DELETE (delete expense by ID)
export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Expense ID is required" },
        { status: 400 }
      );
    }

    // Get current user for audit logging
    const currentUser = await getCurrentUser(req);
    
    // Check if expense exists
    const existing = await prisma.expense.findUnique({
      where: { id: Number(id) },
    });

    if (!existing) {
      return NextResponse.json(
        { success: false, error: "Expense not found" },
        { status: 404 }
      );
    }

    // Log deletion for audit trail
    console.log(`[AUDIT] Expense ${id} (${existing.title}) deleted by ${currentUser.email} (${currentUser.uid}) at ${new Date().toISOString()}`);
    console.log(`[AUDIT] Expense details - Amount: ${existing.amount}, Category: ${existing.category}, Date: ${existing.date}`);

    // Delete the expense
    await prisma.expense.delete({
      where: { id: Number(id) },
    });

    return NextResponse.json({ 
      success: true, 
      message: "Expense deleted successfully",
      deletedExpense: {
        id: existing.id,
        title: existing.title,
        amount: existing.amount,
      },
      deletedBy: {
        email: currentUser.email,
        uid: currentUser.uid,
        name: currentUser.name,
      },
      deletedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("❌ Error deleting expense:", error);
    return NextResponse.json(
      { success: false, error: "Failed to delete expense" },
      { status: 500 }
    );
  }
}

// ✅ GET summary/stats endpoint
export async function HEAD(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const period = searchParams.get("period") || "all"; // day, week, month, year, all
    const category = searchParams.get("category");
    const createdBy = searchParams.get("createdBy");
    
    let startDate = new Date();
    const now = new Date();
    let dateRange = {};
    
    switch(period) {
      case "day":
        startDate.setHours(0, 0, 0, 0);
        dateRange = { gte: startDate, lte: now };
        break;
      case "week":
        startDate.setDate(now.getDate() - now.getDay());
        startDate.setHours(0, 0, 0, 0);
        dateRange = { gte: startDate, lte: now };
        break;
      case "month":
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        dateRange = { gte: startDate, lte: now };
        break;
      case "year":
        startDate = new Date(now.getFullYear(), 0, 1);
        dateRange = { gte: startDate, lte: now };
        break;
      default:
        dateRange = {};
    }
    
    // Build where condition
    let whereCondition: any = {};
    if (Object.keys(dateRange).length > 0) {
      whereCondition.date = dateRange;
    }
    if (category && category !== "all") {
      whereCondition.category = category;
    }
    
    const expenses = await prisma.expense.findMany({
      where: whereCondition,
    });
    
    // Filter by creator if needed (post-query)
    let filteredExpenses = expenses;
    if (createdBy && createdBy !== "all") {
      filteredExpenses = expenses.filter(exp => {
        const creatorInfo = extractCreatorInfo(exp.notes);
        return creatorInfo?.email === createdBy;
      });
    }
    
    const total = filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
    
    // Category breakdown
    const byCategory = filteredExpenses.reduce((acc, exp) => {
      const cat = exp.category || "Uncategorized";
      acc[cat] = (acc[cat] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    
    // Creator stats
    const creatorStats: Record<string, { count: number; total: number; name: string }> = {};
    filteredExpenses.forEach(exp => {
      const creatorInfo = extractCreatorInfo(exp.notes);
      const creatorEmail = creatorInfo?.email || "system";
      const creatorName = creatorInfo?.name || "System";
      
      if (!creatorStats[creatorEmail]) {
        creatorStats[creatorEmail] = { count: 0, total: 0, name: creatorName };
      }
      creatorStats[creatorEmail].count++;
      creatorStats[creatorEmail].total += exp.amount;
    });
    
    // Daily breakdown for the period
    const dailyBreakdown = filteredExpenses.reduce((acc, exp) => {
      const date = exp.date.toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    
    // Monthly breakdown
    const monthlyBreakdown = filteredExpenses.reduce((acc, exp) => {
      const month = exp.date.toISOString().substring(0, 7);
      acc[month] = (acc[month] || 0) + exp.amount;
      return acc;
    }, {} as Record<string, number>);
    
    return NextResponse.json({
      success: true,
      summary: {
        period,
        startDate: startDate.toISOString(),
        endDate: now.toISOString(),
        totalExpenses: filteredExpenses.length,
        totalAmount: total,
        averageAmount: filteredExpenses.length > 0 ? total / filteredExpenses.length : 0,
        highestExpense: filteredExpenses.length > 0 ? Math.max(...filteredExpenses.map(e => e.amount)) : 0,
        lowestExpense: filteredExpenses.length > 0 ? Math.min(...filteredExpenses.map(e => e.amount)) : 0,
        byCategory,
        byCreator: creatorStats,
        dailyBreakdown,
        monthlyBreakdown,
      },
      filters: {
        period,
        category: category || "all",
        createdBy: createdBy || "all",
      }
    });
  } catch (error) {
    console.error("❌ Error fetching expense summary:", error);
    return NextResponse.json(
      { success: false, error: "Failed to fetch expense summary" },
      { status: 500 }
    );
  }
}

// ✅ OPTIONS (for CORS preflight)
export async function OPTIONS() {
  return NextResponse.json(
    {},
    {
      headers: {
        'Allow': 'GET, POST, PUT, DELETE, HEAD, OPTIONS',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    }
  );
}