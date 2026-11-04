Feature: Add Expense
  As a user of the Personal Finance Tracker
  I want to add an expense by entering a name and an amount
  So that I can keep a record of my spending and see my running total

  Background:
    Given I am on the Personal Finance Tracker page

  # ---------------------------------------------------------------------
  # Happy paths
  # ---------------------------------------------------------------------

  Scenario: Adding an expense with a valid name and amount
    When I enter "Coffee" as the expense name
    And I enter "5" as the expense amount
    And I click "Add"
    Then I should see an expense "Coffee" with amount "5" in the list
    And the name field should be empty
    And the amount field should be empty

  Scenario: The total updates after adding an expense
    Given the total is "0"
    When I add an expense named "Coffee" with amount "5"
    Then the total should be "5"

  Scenario: Adding multiple expenses accumulates in the total
    When I add an expense named "Coffee" with amount "5"
    And I add an expense named "Groceries" with amount "30"
    Then I should see an expense "Coffee" with amount "5" in the list
    And I should see an expense "Groceries" with amount "30" in the list
    And the total should be "35"

  Scenario: Adding an expense with a decimal amount
    When I enter "Lunch" as the expense name
    And I enter "12.49" as the expense amount
    And I click "Add"
    Then I should see an expense "Lunch" with amount "12.49" in the list
    And the total should be "12.49"

  Scenario: Adding an expense with a multi-word name
    When I enter "Monthly Gym Membership" as the expense name
    And I enter "40" as the expense amount
    And I click "Add"
    Then I should see an expense "Monthly Gym Membership" with amount "40" in the list

  Scenario: Submitting the form with the Enter key
    When I enter "Coffee" as the expense name
    And I enter "5" as the expense amount
    And I press "Enter"
    Then I should see an expense "Coffee" with amount "5" in the list

  Scenario: Adding two expenses with the same name
    When I add an expense named "Coffee" with amount "5"
    And I add an expense named "Coffee" with amount "3"
    Then I should see two expenses named "Coffee" in the list
    And the total should be "8"

  Scenario: Newly added expenses appear after existing ones
    Given the expense "Coffee" with amount "5" is already in the list
    When I add an expense named "Groceries" with amount "30"
    Then "Coffee" should appear before "Groceries" in the list

  # ---------------------------------------------------------------------
  # Small features / UX details
  # ---------------------------------------------------------------------

  Scenario: Leading and trailing whitespace is trimmed from the name
    When I enter "  Coffee  " as the expense name
    And I enter "5" as the expense amount
    And I click "Add"
    Then I should see an expense "Coffee" with amount "5" in the list

  Scenario: The Add button is disabled until both fields have values
    When the name field is empty
    And the amount field is empty
    Then the "Add" button should be disabled

  Scenario: The Add button becomes enabled once both fields are valid
    When I enter "Coffee" as the expense name
    And I enter "5" as the expense amount
    Then the "Add" button should be enabled

  Scenario: Focus returns to the name field after adding an expense
    When I add an expense named "Coffee" with amount "5"
    Then the name field should have focus

  # ---------------------------------------------------------------------
  # Validation errors
  # ---------------------------------------------------------------------

  Scenario: The expense name is required
    When I enter "" as the expense name
    And I enter "5" as the expense amount
    And I click "Add"
    Then no expense should be added to the list
    And I should see an error message that the name is required

  Scenario: A whitespace-only name is treated as empty
    When I enter "   " as the expense name
    And I enter "5" as the expense amount
    And I click "Add"
    Then no expense should be added to the list
    And I should see an error message that the name is required

  Scenario Outline: The expense amount must be a positive number
    When I enter "Coffee" as the expense name
    And I enter "<amount>" as the expense amount
    And I click "Add"
    Then no expense should be added to the list
    And I should see an error message that the amount is invalid

    Examples:
      | amount |
      |        |
      | 0      |
      | -5     |
      | abc    |
      | 5a     |
      | 5-5    |
      | NaN    |

  Scenario: Both the name and amount are missing
    When I enter "" as the expense name
    And I enter "" as the expense amount
    And I click "Add"
    Then no expense should be added to the list
    And I should see an error message that the name is required
    And I should see an error message that the amount is invalid

  Scenario: Correcting an invalid field clears its error on resubmission
    Given I attempted to add an expense with an empty name and amount "5"
    When I enter "Coffee" as the expense name
    And I click "Add"
    Then I should see an expense "Coffee" with amount "5" in the list
    And I should not see an error message that the name is required

  # ---------------------------------------------------------------------
  # Negative / edge-case scenarios
  # ---------------------------------------------------------------------

  Scenario: An invalid submission does not change the existing list or total
    Given the expense "Coffee" with amount "5" is already in the list
    When I enter "" as the expense name
    And I enter "5" as the expense amount
    And I click "Add"
    Then the list should still contain only "Coffee" with amount "5"
    And the total should still be "5"

  Scenario: Clicking Add twice in quick succession only adds the expense once
    When I enter "Coffee" as the expense name
    And I enter "5" as the expense amount
    And I click "Add" twice in quick succession
    Then I should see exactly one expense "Coffee" with amount "5" in the list
    And the total should be "5"

  Scenario: An extremely long name is rejected
    When I enter a name that is 256 characters long
    And I enter "5" as the expense amount
    And I click "Add"
    Then no expense should be added to the list
    And I should see an error message that the name is too long

  Scenario: An amount with more than two decimal places is rejected
    When I enter "Coffee" as the expense name
    And I enter "5.999" as the expense amount
    And I click "Add"
    Then no expense should be added to the list
    And I should see an error message that the amount is invalid

  Scenario: An amount pasted with a currency symbol is rejected
    When I enter "Coffee" as the expense name
    And I enter "$5" as the expense amount
    And I click "Add"
    Then no expense should be added to the list
    And I should see an error message that the amount is invalid

  Scenario: Script-like input in the name field is stored and displayed as plain text
    When I enter "<script>alert('x')</script>" as the expense name
    And I enter "5" as the expense amount
    And I click "Add"
    Then I should see an expense "<script>alert('x')</script>" with amount "5" in the list
    And no script should execute on the page
