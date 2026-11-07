Feature: Add expense
  As a user of the Personal Finance Tracker
  I want to add an expense with a name and an amount
  So that I can keep track of my spending

  Background:
    Given I am on the home page

  Scenario: Add an expense with a valid name and amount
    When I enter "Groceries" as the expense name
    And I enter "42.50" as the expense amount
    And I submit the expense
    Then the expense "Groceries" with amount "42.50" should appear in the expense list
    And the expense name field should be empty
    And the expense amount field should be empty

  Scenario: Add an expense with a decimal amount
    When I enter "Taxi" as the expense name
    And I enter "15.75" as the expense amount
    And I submit the expense
    Then the expense "Taxi" with amount "15.75" should appear in the expense list

  Scenario: Attempt to add an expense without a name
    When I enter "" as the expense name
    And I enter "20" as the expense amount
    And I submit the expense
    Then I should see an error message "Name is required"
    And the expense should not appear in the expense list

  Scenario: Attempt to add an expense without an amount
    When I enter "Coffee" as the expense name
    And I enter "" as the expense amount
    And I submit the expense
    Then I should see an error message "Amount is required"
    And the expense should not appear in the expense list

  Scenario Outline: Attempt to add an expense with an invalid amount
    When I enter "Coffee" as the expense name
    And I enter "<amount>" as the expense amount
    And I submit the expense
    Then I should see an error message "<error>"
    And the expense should not appear in the expense list

    Examples:
      | amount | error                         |
      | 0      | Amount must be greater than 0 |
      | -5     | Amount must be greater than 0 |
      | abc    | Amount must be a number       |

  Scenario: Add multiple expenses
    When I enter "Groceries" as the expense name
    And I enter "42.50" as the expense amount
    And I submit the expense
    And I enter "Bus ticket" as the expense name
    And I enter "3.20" as the expense amount
    And I submit the expense
    Then the expense list should contain the following expenses:
      | name       | amount |
      | Groceries  | 42.50  |
      | Bus ticket | 3.20   |
