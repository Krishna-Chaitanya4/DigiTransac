# Testing Strategy - Quick Reference

## 🎯 The Pattern

**agents.md is the ONLY source of truth for testing.**

### For Each Feature/Phase:

1. **Complete the feature** → Build ✅ Tests ✅
2. **Write test cases** for that feature
3. **Run tests** → Verify they pass
4. **Update agents.md** → Add test results to the appropriate section
5. **Commit** → "feat: [feature name] - [X] tests passing"
6. **Move to next feature** → Repeat

---

## 📊 How agents.md Tracks Tests

### Location: Part 11 - Iterative Testing Strategy

**Components:**
- **Test Suite Inventory** - Master list of all tests by phase/feature
- **Test Tracking Table** - Summary status of all test files
- **Phase sections** - Detailed tests for each phase (completed/pending)

**Example for Phase 1 Auth:**
```markdown
### **Phase 1: Authentication** ✅ COMPLETE

**Integration Tests (Endpoints):**
- File: `test-auth-complete.ps1`
- Status: ✅ 8/8 PASSING
- Coverage: (list of 8 tests)
```

**Example for Phase 1.B Frontend (Pending):**
```markdown
### **Phase 1.B: React Frontend** ⏳ PENDING

**Component Tests (When Phase 1.B Complete):**
- [ ] Login page rendering
- [ ] Register page rendering
- ... (list of pending tests)
```

---

## 🔄 Workflow Example: Phase 2 (Categories)

### Step 1: Feature Complete
- ✅ Backend implemented (CRUD, hierarchy, search)
- ✅ Build successful
- ✅ API endpoints working

### Step 2: Create Tests
Create `test-categories.ps1` with:
- [ ] Create category
- [ ] Get category
- [ ] Update category
- [ ] Delete category
- [ ] Search categories
- [ ] Filter by type
- [ ] Move to parent
- [ ] Calculate statistics

### Step 3: Run & Verify
```bash
.\test-categories.ps1
# Output: ✓ 8/8 PASSING
```

### Step 4: Update agents.md
Find "Phase 2: Categories" section and update:
```markdown
### **Phase 2: Categories** ✅ COMPLETE

**Tests (Add After Feature Complete):**
- ✅ Create category with hierarchy
- ✅ Get category by ID
- ✅ Update category
- ✅ Delete category (soft)
- ✅ Search categories
- ✅ Filter by type (folder/category)
- ✅ Calculate statistics
- ✅ Move to parent

Status: ✅ 8/8 PASSING
File: test-categories.ps1
```

### Step 5: Commit
```bash
git commit -m "feat: Categories feature complete - 8 tests passing

- Implemented category CRUD with hierarchy
- Added search and filter functionality
- Added statistics calculation
- All 8 test cases passing
- Updated agents.md with test results"
```

### Step 6: Update Test Tracking Table
```markdown
| Phase | Feature | Tests | Status | File |
|-------|---------|-------|--------|------|
| 2 | Categories | 8 | ✅ Complete | test-categories.ps1 |
```

---

## ✅ Current State (After Phase 1)

**agents.md shows:**
- Phase 1 Auth: 8/8 tests ✅ PASSING
- Phase 1.B Frontend: 0 tests (pending)
- Phase 2 Categories: 0 tests (pending)
- Phase 2 Accounts: 0 tests (pending)
- Phase 3 Transactions: 0 tests (pending)
- Phase 3 Budgets: 0 tests (pending)

**As we complete each phase:**
- Add tests
- Update agents.md
- Commit
- Move to next

---

## 📝 Benefits

1. **Single Source of Truth** - No confusion about test status
2. **Incremental Growth** - Tests grow with features
3. **Clear Progress** - agents.md shows exactly where we are
4. **Easy Review** - Anyone can see which phases have tests
5. **Prevents Rework** - Documentation stays current

---

## 🎯 Next Steps

1. **Phase 1.B:** Create React tests (when frontend complete)
2. **Phase 2:** Create Categories tests (when backend complete)
3. **Continue pattern:** Each phase follows same workflow

**Remember:** Always update agents.md after completing tests!
