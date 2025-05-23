import { Question } from "@prisma/client"
import { ActionsBlock, ModalView } from "@slack/types"
import { getDateYYYYMMDD } from "../_utils_common"
import {
  CheckboxOption,
  markdownBlock,
  textBlock,
  tipsContextBlock,
  toActionId,
} from "./_block_utils"

export function buildEditQuestionModalView(
  question: Partial<Question>,
  isCreating: boolean,
  channel: string,
  hideForecastsJustChecked?: boolean,
): ModalView {
  const isHidingForecasts =
    hideForecastsJustChecked !== undefined
      ? hideForecastsJustChecked
      : question.hideForecastsUntil != undefined
  const hideUntil =
    question?.hideForecastsUntil ||
    question?.resolveBy ||
    new Date(Date.now() + 3600 * 1000 * 24) // default = tomorrow

  return {
    type: "modal",
    callback_id: `question_modal${toActionId({
      action: "qModal",
      questionId: question?.id,
      isCreating,
      channel,
    })}`,
    title: textBlock(`${isCreating ? "Create" : "Edit"} forecast question`),
    submit: textBlock(isCreating ? "Submit" : "Save changes"),
    close: textBlock("Cancel"),
    blocks: [
      {
        block_id: "question_title",
        type: "input",
        label: textBlock("Question"),
        element: {
          type: "plain_text_input",
          action_id: "forecast_question",
          placeholder: textBlock("Will humans walk on Mars by 2050?"),
          initial_value: question?.title || "",
        },
      },
      {
        block_id: "resolution_date",
        type: "input",
        label: textBlock("When should I remind you to resolve this question?"),
        element: {
          type: "datepicker",
          initial_date: getDateYYYYMMDD(
            question?.resolveBy || new Date(Date.now() + 3600 * 1000 * 24), // default = tomorrow
          ),
          placeholder: textBlock("Select a date"),
          action_id: toActionId({
            action: "updateResolutionDate",
          }),
        },
      },
      {
        block_id: "notes",
        type: "input",
        label: textBlock("Notes"),
        element: {
          type: "plain_text_input",
          action_id: "notes",
          placeholder: textBlock(" "),
          multiline: true,
          initial_value: question?.notes || "",
        },
        optional: true,
      },
      optionsCheckboxes(isHidingForecasts, isCreating, hideUntil, question?.id),
      ...(isHidingForecasts ? [hideForecastsUntilDatePicker(hideUntil)] : []),
      ...(isCreating
        ? []
        : [
            {
              // only show delete button if editing
              type: "actions",
              elements: [
                {
                  type: "button",
                  style: "danger",
                  text: textBlock("Delete question"),
                  confirm: {
                    title: textBlock("Delete question?"),
                    text: textBlock(
                      "Are you sure you want to delete this question?",
                    ),
                    confirm: textBlock("Delete"),
                    deny: textBlock("Cancel"),
                    style: "danger",
                  },
                  action_id: toActionId({
                    action: "deleteQuestion",
                    questionId: question.id || "",
                  }),
                },
              ],
            } as ActionsBlock,
          ]),
      tipsContextBlock(),
    ],
  }
}

const hideCheckbox = {
  label: "Hide forecasts until a specific date to prevent anchoring",
  valueLabel: "hide_forecasts_until_date",
}
export const checkboxes: CheckboxOption[] = [hideCheckbox]

function optionsCheckboxes(
  isHidingForecasts: boolean,
  isCreating: boolean,
  hideUntil: Date,
  questionId?: string,
) {
  console.log({ isHidingForecasts, hideUntil })
  const toCheckbox = (cb: CheckboxOption) => ({
    text: textBlock(cb.label),
    value: cb.valueLabel,
  })

  return {
    block_id: "option_checkboxes",
    type: "section",
    text: markdownBlock("*Options*"),
    accessory: {
      type: "checkboxes",
      options: [...checkboxes.map(toCheckbox)],
      ...(isHidingForecasts
        ? { initial_options: [toCheckbox(hideCheckbox)] }
        : {}),
      action_id: toActionId({
        action: "optionsCheckBox",
        questionId,
        questionResolutionDate: hideUntil,
        isCreating,
      }),
    },
  }
}

function hideForecastsUntilDatePicker(hideUntil: Date) {
  return {
    type: "section",
    text: markdownBlock("Hide all forecasts until:"),
    accessory: {
      type: "datepicker",
      initial_date: getDateYYYYMMDD(hideUntil),
      placeholder: {
        type: "plain_text",
        text: "Select a date",
        emoji: true,
      },
      action_id: toActionId({
        action: "updateHideForecastsDate",
      }),
    },
  }
}
